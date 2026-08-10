import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { sendPushToAdmin } from "@/lib/push";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slot_id, client_name, client_phone, client_email, client_tg } = body;

  if (!slot_id || !client_name || !client_phone) {
    return NextResponse.json({ error: "Поля слот, имя и телефон обязательны" }, { status: 400 });
  }

  const { data: slot } = await supabaseAdmin
    .from("slots")
    .select("is_booked, slot_time")
    .eq("id", slot_id)
    .single();

  if (!slot || slot.is_booked) {
    return NextResponse.json({ error: "Это время уже занято" }, { status: 409 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("brt_bookings")
    .insert({ slot_id, client_name, client_phone, client_email: client_email || null, client_tg: client_tg || null })
    .select()
    .single();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  await supabaseAdmin.from("slots").update({ is_booked: true }).eq("id", slot_id);

  const slotTime = slot.slot_time;
  await supabaseAdmin
    .from("slots")
    .update({ is_booked: true })
    .eq("slot_time", slotTime)
    .neq("id", slot_id);

  const date = new Date(slotTime).toLocaleString("ru", { timeZone: "Europe/Moscow" });

  await sendTelegram(
    `<b>🟢 Новая заявка — БРТ</b>\n\n` +
    `<b>Имя:</b> ${client_name}\n` +
    `<b>Телефон:</b> ${client_phone}\n` +
    (client_email ? `<b>Email:</b> ${client_email}\n` : "") +
    (client_tg ? `<b>Telegram:</b> ${client_tg}\n` : "") +
    `<b>Дата:</b> ${date}\n\n` +
    `<a href="http://85.198.71.172/admin/bookings">Подтвердить в админке</a>`
  );

  await sendPushToAdmin('new_booking', `${client_name}, БРТ, ${date}`);

  return NextResponse.json({ ok: true, booking }, { status: 201 });
}
