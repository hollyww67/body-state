import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";
import { transitionOrderState } from "@/lib/order-stock";
import { settleBookingPayments } from "@/lib/booking-payments";
import { cancelPayment } from "@/lib/tbank";
import { readJsonObject } from "@/lib/request";

export async function GET() {
  const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Не удалось загрузить заказы" }, { status: 500 });
  return NextResponse.json({ orders: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 4096); }
  catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const status = String(body.status || "");
  const transitions: Record<string, string[]> = { shipped: ["paid"], delivered: ["shipped"], cancelled: ["pending", "failed"] };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !transitions[status]) return NextResponse.json({ error: "Недопустимый статус. Оплата подтверждается банком." }, { status: 400 });
  const { data: order, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Не удалось загрузить заказ" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (order.status === status) return NextResponse.json({ ok: true });
  if (!transitions[status].includes(String(order.status))) return NextResponse.json({ error: "Этот переход статуса недоступен. Обновите список." }, { status: 409 });
  try {
    if (status === "cancelled" && order.payment_id) {
      const response = await cancelPayment(String(order.payment_id));
      if (response?.Success !== true || !["CANCELED", "CANCELLED"].includes(String(response.Status).toUpperCase())) {
        return NextResponse.json({ error: "Банк не подтвердил отмену. Проверьте состояние платежа." }, { status: 409 });
      }
    }
    const transition = await transitionOrderState(id, status, { allowedFrom: transitions[status], releaseStock: status === "cancelled" });
    if (!transition.changed && transition.reason !== "unchanged") return NextResponse.json({ error: "Статус заказа изменился. Обновите список." }, { status: 409 });
    if (status === "cancelled") await settleBookingPayments(order.items || [], "cancelled");
  } catch (error) {
    console.error("[Admin orders] Status update failed", error);
    return NextResponse.json({ error: "Не удалось изменить статус" }, { status: 500 });
  }
  if (order) {
    const labels: Record<string, string> = { confirmed: "✅ Подтверждён", paid: "💰 Оплачен", shipped: "📦 Отправлен", delivered: "🏁 Доставлен", cancelled: "❌ Отменён" };
    await sendTelegram(`📋 Статус заказа #${order.id.slice(0, 8)} → ${labels[status] || status}\nСумма: ${order.total} ₽\nДетали доступны в защищённой админке.`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  const { data: order } = await db.from("orders").select("status").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (order.status !== "delivered" && order.status !== "cancelled") {
    return NextResponse.json({ error: "Можно удалять только доставленные или отменённые заказы" }, { status: 400 });
  }

  await db.from("orders").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
