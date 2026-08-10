import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { client_name, client_phone, notes } = body;

  if (!client_name || !client_phone) {
    return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("program_enrollments").insert({
    client_name,
    client_phone,
    notes: notes || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sendTelegram(
    `⭐ <b>Новая заявка — Комплексная программа</b>\n\n` +
    `👤 ${client_name}\n` +
    `📞 ${client_phone}\n` +
    (notes ? `📝 ${notes}\n` : "") +
    `\n<a href="https://body-state.ru/admin/bookings">Открыть заявки</a>`
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
