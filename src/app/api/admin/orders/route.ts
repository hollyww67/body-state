import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";

export async function GET() {
  const { data } = await supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ orders: data || [] });
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const { status } = await request.json();

  await supabaseAdmin.from("orders").update({ status }).eq("id", id);

  const { data: order } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
  if (order) {
    const labels: Record<string, string> = { confirmed: "✅ Подтверждён", paid: "💰 Оплачен", shipped: "📦 Отправлен", delivered: "🏁 Доставлен", cancelled: "❌ Отменён" };
    await sendTelegram(`📋 Статус заказа #${order.id.slice(0, 8)} → ${labels[status] || status}\nКлиент: ${order.client_name}\nСумма: ${order.total} ₽`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (order.status !== "delivered" && order.status !== "cancelled") {
    return NextResponse.json({ error: "Можно удалять только доставленные или отменённые заказы" }, { status: 400 });
  }

  await supabaseAdmin.from("orders").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
