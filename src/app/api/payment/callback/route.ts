import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyNotificationToken } from "@/lib/tbank";
import { sendTelegram } from "@/lib/telegram";
import { escapeHtml, adminBookingsUrl } from "@/lib/slots";
import { readJsonObject } from "@/lib/request";
import { transitionOrderState } from "@/lib/order-stock";
import { settleBookingPayments } from "@/lib/booking-payments";
import { recordSuccessfulVisit } from "@/lib/loyalty";
import { isMonetaryNotification, processMonetaryNotification } from "@/lib/payment-lifecycle";

const TERMINAL_PAID = new Set(["CONFIRMED"]);
const TERMINAL_FAILED = new Set(["REJECTED", "AUTH_FAIL", "DEADLINE_EXPIRED"]);
const TERMINAL_CANCELLED = new Set(["CANCELED", "CANCELLED", "REVERSED"]);
const TERMINAL_REFUNDED = new Set(["REFUNDED"]);
const FINAL_STATUSES = new Set(["paid", "shipped", "delivered", "refunded"]);

type CallbackOrder = {
  id: string;
  status: string;
  items: Array<Record<string, unknown>>;
  total: number;
  client_name: string;
  client_phone: string;
  receipt_email: string | null;
  payment_id: string | null;
  loyalty_client_phone: string | null;
  loyalty_service_code: "bfm" | "brt" | "psychology" | "psychology_program" | null;
  counts_as_visit: boolean;
  account_user_id: string | null;
};

async function recordOrderVisit(order: CallbackOrder) {
  if (!order.counts_as_visit || !order.loyalty_client_phone || !order.loyalty_service_code) return;
  await recordSuccessfulVisit({
    accountUserId: order.account_user_id,
    phone: order.loyalty_client_phone,
    email: order.receipt_email,
    serviceCode: order.loyalty_service_code,
    orderId: order.id,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, 32_768);

    if (!verifyNotificationToken(body)) {
      console.error("[Callback] Invalid Token");
      return new NextResponse("Invalid token", { status: 403 });
    }
    const paymentData = { ...body };
    delete paymentData.Token;

    const { Status, PaymentId, Amount, OrderId } = body as {
      Status?: string;
      PaymentId?: string;
      Amount?: number;
      OrderId?: string;
    };

    const statusRaw = String(Status || "").toUpperCase();
    if (isMonetaryNotification(statusRaw)) {
      const result = await processMonetaryNotification(paymentData);
      if (result.notify) await sendTelegram(
        `<b>💳 Оплата получена</b>\n\n<b>Заказ:</b> ${escapeHtml(result.notify.id)}\n<b>Сумма:</b> ${escapeHtml(String(result.notify.total))} ₽\n<b>Детали:</b> в защищённой админке\n\n<a href="${adminBookingsUrl()}">Админка</a>`
      );
      return new NextResponse(result.status === 200 ? "OK" : "Retry", {status:result.status});
    }
    const monetary = TERMINAL_PAID.has(statusRaw) || TERMINAL_REFUNDED.has(statusRaw) || statusRaw === "PARTIAL_REFUNDED";
    if (!PaymentId) return new NextResponse(monetary ? "Retry" : "OK", { status: monetary ? 503 : 200 });

    const { data: initialOrders, error: findError } = await db
      .from<CallbackOrder>("orders")
      .select("id, status, items, total, client_name, client_phone, receipt_email, payment_id, loyalty_client_phone, loyalty_service_code, counts_as_visit, account_user_id")
      .eq("payment_id", String(PaymentId))
      .limit(1);

    if (findError) throw findError;
    let orders = initialOrders;
    if ((!orders || orders.length === 0) && typeof OrderId === "string" && /^[0-9a-f-]{36}$/i.test(OrderId)) {
      const fallback = await db
        .from<CallbackOrder>("orders")
        .select("id, status, items, total, client_name, client_phone, receipt_email, payment_id, loyalty_client_phone, loyalty_service_code, counts_as_visit, account_user_id")
        .eq("id", OrderId)
        .limit(1);
      if (fallback.error) throw fallback.error;
      orders = fallback.data;
    }

    if (!orders || orders.length === 0) {
      // Never acknowledge money that has no durable local order. Keep the
      // provider notification retryable until its linkage is reconciled.
      if (monetary) return new NextResponse("Retry", { status: 503 });
      // A cancelled order can be removed from the admin before T-Bank sends its
      // final asynchronous notification. The callback is already signed, so
      // acknowledge it to stop pointless provider retries.
      console.warn("[Callback] Signed notification for an order that no longer exists:", PaymentId);
      return new NextResponse("OK", { status: 200 });
    }

    const order = orders[0];
    const orderId = order.id;
    if (order.payment_id && String(order.payment_id) !== String(PaymentId)) {
      console.error(`[Callback] PaymentId mismatch for order ${orderId}`);
      return new NextResponse("Payment mismatch", { status: 409 });
    }
    if (!order.payment_id) {
      const { error: paymentIdError } = await db.from("orders").update({ payment_id: String(PaymentId) }).eq("id", String(orderId));
      if (paymentIdError) throw paymentIdError;
    }
    if (statusRaw === "PARTIAL_REFUNDED") {
      // A partial refund does not return all inventory or cancel fulfillment.
      const { data, error } = await db.from("orders").update({ payment_data: paymentData }).eq("id", orderId);
      if (error) throw error;
      if (!data?.length) return new NextResponse("Retry", { status: 503 });
      return new NextResponse("OK", { status: 200 });
    }

    if (FINAL_STATUSES.has(order.status) && !TERMINAL_REFUNDED.has(statusRaw)) {
      // Nonmonetary notifications cannot perform settlement from a stale order.
      // The monetary executor above owns payment reconciliation and its locks.
      console.log(`[Callback] Заказ ${orderId} уже ${order.status}, игнорируем ${statusRaw}`);
      return new NextResponse("OK", { status: 200 });
    }

    if (TERMINAL_PAID.has(statusRaw)) {
      const expectedKopecks = Math.round(Number(order.total) * 100);
      if (!Number.isFinite(Number(Amount)) || Number(Amount) !== expectedKopecks) {
        console.error(
          `[Callback] Amount mismatch order=${orderId} expected=${expectedKopecks} got=${Amount}`
        );
        return new NextResponse("Amount mismatch", { status: 400 });
      }

      // Accept CONFIRMED even if cron already cancelled — money was taken
      const transition = await transitionOrderState(String(orderId), "paid", {
        allowedFrom: ["pending", "failed", "cancelled"],
        paidAt: new Date().toISOString(),
        amountPaid: Number(order.total),
        paymentData,
      });
      if (!transition.changed) {
        if (!transition.order) return new NextResponse("Retry", { status: 503 });
        if (["paid", "shipped", "delivered"].includes(transition.order.status)) {
          // Another CONFIRMED may have committed paid after our initial read,
          // while its booking settlement is still running or interrupted.
          await settleBookingPayments(transition.order.items || [], "paid");
          await recordOrderVisit(order);
        } else if (transition.order.status !== "refunded") {
          return new NextResponse("Retry", { status: 503 });
        }
        return new NextResponse("OK", { status: 200 });
      }

      await settleBookingPayments(order.items || [], "paid");
      await recordOrderVisit(order);

      await sendTelegram(
        `<b>💳 Оплата получена</b>\n\n` +
          `<b>Заказ:</b> ${escapeHtml(String(orderId))}\n` +
          `<b>Сумма:</b> ${escapeHtml(String(order.total))} ₽\n` +
          `<b>Детали:</b> в защищённой админке\n\n` +
          `<a href="${adminBookingsUrl()}">Админка</a>`
      );

      return new NextResponse("OK", { status: 200 });
    }

    let nextStatus: string | null = null;
    if (TERMINAL_FAILED.has(statusRaw)) nextStatus = "failed";
    else if (TERMINAL_CANCELLED.has(statusRaw)) nextStatus = "cancelled";
    else if (TERMINAL_REFUNDED.has(statusRaw)) nextStatus = "refunded";
    else {
      console.log(`[Callback] Ignoring intermediate status ${statusRaw} for ${orderId}`);
      return new NextResponse("OK", { status: 200 });
    }

    if (order.status === nextStatus) {
      if (["failed", "cancelled"].includes(nextStatus)) {
        await settleBookingPayments(order.items || [], "cancelled", orderId);
      }
      return new NextResponse("OK", { status: 200 });
    }

    const allowedFrom = nextStatus === "refunded" ? ["pending", "paid", "shipped", "delivered", "failed", "cancelled"] : ["pending"];
    const transition = await transitionOrderState(String(orderId), nextStatus, {
      allowedFrom,
      releaseStock: !["shipped", "delivered"].includes(order.status),
      paymentData,
    });
    if (nextStatus === "refunded" && !transition.changed && transition.order?.status !== "refunded") {
      return new NextResponse("Retry", { status: 503 });
    }
    if (["failed", "cancelled"].includes(nextStatus)) {
      // Even unchanged/conflicting transitions reconcile under the current order
      // row lock. Paid/refunded orders are never cancelled by a stale notification.
      await settleBookingPayments(order.items || [], "cancelled", orderId);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("Callback error:", e);
    return new NextResponse("Retry", { status: 500 });
  }
}
