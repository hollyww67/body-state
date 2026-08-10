import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { sendPushToAdmin } from "@/lib/push";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { client_name, client_phone, address, delivery, items, total } = body;

  if (!client_name || !client_phone || !address || !items?.length) {
    return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin.from("orders").insert({
    client_name, client_phone, address, delivery, items, total,
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Увеличиваем popularity
  for (const item of items) {
    if (item.productId) {
      const { data: product } = await supabaseAdmin.from("products").select("popularity").eq("id", item.productId).single();
      const current = product?.popularity || 0;
      await supabaseAdmin.from("products").update({ popularity: current + (item.quantity || 1) }).eq("id", item.productId);
    }
  }

  const itemsList = items.map((i: any) => `— ${i.name} × ${i.quantity} (${i.price * i.quantity} ₽)`).join("\n");
  await sendTelegram(
    `🛍 <b>Новый заказ!</b>\n\n` +
    `<b>Клиент:</b> ${client_name}\n<b>Телефон:</b> ${client_phone}\n` +
    `<b>Адрес:</b> ${address}\n<b>Доставка:</b> ${delivery === "cdek" ? "СДЭК" : "Курьер"}\n` +
    `<b>Товары:</b>\n${itemsList}\n\n<b>Итого:</b> ${total} ₽\n\n<i>Ожидает оплаты</i>`
  );
  await sendPushToAdmin('new_order', `${client_name}, ${total} ₽`);

  return NextResponse.json({ ok: true, order }, { status: 201 });
}
