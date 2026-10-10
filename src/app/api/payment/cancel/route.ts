import { NextRequest, NextResponse } from "next/server";
import { cancelPayment } from "@/lib/tbank";
import { requireAdmin } from "@/lib/admin-auth";
import { requireCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { transitionOrderState } from "@/lib/order-stock";
import { settleBookingPayments } from "@/lib/booking-payments";

export async function POST(request: NextRequest) {
  // Admin session OR cron secret
  const cronAuth = requireCronSecret(request);
  if (cronAuth) {
    const adminAuth = await requireAdmin(request);
    if (adminAuth) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    let body: { paymentId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Некорректный JSON" }, { status: 400 });
    }

    const paymentId = String(body?.paymentId || "").trim();
    if (!paymentId || paymentId.length > 40) {
      return NextResponse.json({ success: false, error: "PaymentId обязателен" }, { status: 400 });
    }

    const tbankResponse = await cancelPayment(paymentId);
    if (!tbankResponse || tbankResponse.Success !== true) {
      return NextResponse.json({
        success: false,
        error: (tbankResponse?.Message as string) || "Ошибка отмены",
        errorCode: tbankResponse?.ErrorCode,
      }, { status: 400 });
    }

    const { data: order } = await db.from("orders").select("id, items").eq("payment_id", paymentId).eq("status", "pending").maybeSingle();
    if (order) {
      const transition = await transitionOrderState(String(order.id), "cancelled", { allowedFrom: ["pending"], releaseStock: true });
      if (transition.changed) {
        await settleBookingPayments(order.items || [], "cancelled");
      }
    }

    return NextResponse.json({
      success: true,
      paymentId: tbankResponse.PaymentId || paymentId,
      status: tbankResponse.Status,
    });
  } catch (error) {
    console.error("[T-Bank Cancel] Error:", error);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка" }, { status: 500 });
  }
}
