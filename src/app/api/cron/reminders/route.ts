import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramToClient, sendEmail } from "@/lib/notifications";
import { sendSMS } from "@/lib/sms";

export async function GET() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);
  const end = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

  const reminders: string[] = [];

  for (const table of ["bfm_bookings", "brt_bookings", "psychology_bookings"]) {
    const { data: bookings } = await supabaseAdmin
      .from(table)
      .select("id, client_name, client_phone, client_email, client_tg, slot_id")
      .eq("status", "confirmed");

    if (!bookings) continue;

    for (const booking of bookings) {
      const { data: slot } = await supabaseAdmin
        .from("slots")
        .select("slot_time")
        .eq("id", booking.slot_id)
        .single();

      if (!slot) continue;

      const slotTime = new Date(slot.slot_time);
      if (slotTime >= start && slotTime <= end) {
        const time = slotTime.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
        const date = slotTime.toLocaleDateString("ru", { timeZone: "Europe/Moscow" });

        // SMS
        if (booking.client_phone) {
          const sent = await sendSMS(
            booking.client_phone,
            `${booking.client_name}, напоминаем о записи завтра ${date} в ${time}. Через тело к состоянию, Хотьково.`
          );
          if (sent) reminders.push(`SMS отправлено: ${booking.client_name}`);
        }

        // Telegram
        if (booking.client_tg) {
          try {
            await sendTelegramToClient(booking.client_tg, `🌸 Добрый день, ${booking.client_name}!\n\nНапоминаем о вашей записи завтра, ${date} в ${time}.\n\nДо встречи!`);
            reminders.push(`TG отправлено: ${booking.client_name}`);
          } catch {}
        }

        // Email
        if (booking.client_email) {
          try {
            await sendEmail(booking.client_email, "Напоминание о записи",
              `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#F6F5F2;border-radius:16px">
                <h2 style="color:#0F766E">Напоминание о записи</h2>
                <p>${booking.client_name}, напоминаем о вашей записи завтра, ${date} в ${time}.</p>
                <p style="color:#6B7280;font-size:14px">Если нужно перенести запись — свяжитесь с нами.</p>
              </div>`
            );
            reminders.push(`Email отправлен: ${booking.client_name}`);
          } catch {}
        }
      }
    }
  }

  return NextResponse.json({ ok: true, count: reminders.length, reminders });
}
