import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { cancelPayment, getPaymentState } from "@/lib/tbank";
import { requireCronSecret } from "@/lib/cron-auth";
import { transitionOrderState } from "@/lib/order-stock";
import { settleBookingPayments } from "@/lib/booking-payments";
import { recordSuccessfulVisit } from "@/lib/loyalty";
import { refreshScheduleOccupancy } from "@/lib/slots";
import {invalidateAppointmentNotifications,enqueueAppointment} from '@/lib/appointment-notifications';

const PAID_STATUSES = new Set(["CONFIRMED"]);

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: overdueOrders, error: findError } = await db
      .from("orders")
      .select("id, items, payment_id, total, payment_method, payment_link_expires_at, account_user_id, loyalty_client_phone, receipt_email, loyalty_service_code, counts_as_visit")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    if (findError) {
      console.error("[Cron cancel-pending] Ошибка выборки:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    let cancelled = 0;
    let markedPaid = 0;

    for (const order of overdueOrders || []) {
      const isManualLink = order.payment_method === "tinkoff_link";
      const expiresAt = order.payment_link_expires_at
        ? new Date(String(order.payment_link_expires_at)).getTime()
        : 0;
      if (isManualLink && expiresAt > Date.now()) continue;

      // Missing PaymentId after a timeout is not proof that Init failed at the bank.
      if (!order.payment_id) {
        const uncertain = await pool.query("SELECT 1 FROM payment_cases WHERE order_id=$1 AND reason='payment_init_uncertain' LIMIT 1", [order.id]);
        if (uncertain.rowCount) continue;
      }

      if (order.payment_id) {
        const state = await getPaymentState(String(order.payment_id));
        // A timeout is not evidence of non-payment. Keep the reservation for retry.
        if (state?.Success !== true) continue;
        const status = String(state?.Status || "").toUpperCase();

        if (PAID_STATUSES.has(status)) {
          if (Number(state.Amount) !== Math.round(Number(order.total) * 100)) continue;
          const transition = await transitionOrderState(String(order.id), "paid", {
            allowedFrom: ["pending", "cancelled", "failed"],
            paidAt: new Date().toISOString(),
            amountPaid: Number(order.total),
          });
          await settleBookingPayments(order.items || [], "paid");
          if (order.counts_as_visit && order.loyalty_client_phone && order.loyalty_service_code) {
            await recordSuccessfulVisit({ accountUserId: order.account_user_id, phone: order.loyalty_client_phone, email: order.receipt_email, serviceCode: order.loyalty_service_code, orderId: String(order.id) });
          }
          if (transition.changed) {
            markedPaid++;
          }
          continue;
        }

        // Close open payment session at T‑Bank before DB cancel
        if (!["CANCELED", "CANCELLED", "REJECTED", "AUTH_FAIL", "DEADLINE_EXPIRED"].includes(status)) {
          const cancellation = await cancelPayment(String(order.payment_id));
          if (cancellation?.Success !== true || !["CANCELED", "CANCELLED"].includes(String(cancellation.Status).toUpperCase())) continue;
        }
      }

      const transition = await transitionOrderState(String(order.id), "cancelled", {
        allowedFrom: ["pending"],
        releaseStock: true,
      });
      if (transition.changed) {
        await settleBookingPayments(order.items || [], "cancelled");
        cancelled++;
      }
    }

    // A visitor may close the form after reserving a slot but before payment Init.
    // These orphan holds have no order for the normal cancellation loop to find.
    const expiredHolds = await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      let count = 0;
      for (const service of ["bfm", "brt", "psychology"] as const) {
        const result = await client.query(`
          UPDATE ${service}_bookings b SET status='cancelled', updated_at=now()
           WHERE status='pending' AND COALESCE(hold_expires_at,created_at+interval '10 minutes')<=now()
             AND NOT EXISTS (
               SELECT 1 FROM orders o, jsonb_array_elements(o.items) item
                WHERE item->>'bookingId'=b.id::text AND item->>'bookingType'=$1
                  AND o.status IN ('pending','paid','shipped','delivered')
             ) RETURNING id`, [service]);
        for(const b of result.rows){await invalidateAppointmentNotifications(client,service,b.id);await enqueueAppointment(client,service,b.id,'cancelled');}
        count += result.rowCount || 0;
      }
      return count;
    });
    if (expiredHolds) await refreshScheduleOccupancy();

    console.log(`[Cron cancel-pending] cancelled=${cancelled} markedPaid=${markedPaid}`);
    return NextResponse.json({ cancelled, markedPaid, expiredHolds });
  } catch (e) {
    console.error("[Cron cancel-pending] Исключение:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
