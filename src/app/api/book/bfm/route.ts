import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";
import { sendPushToAdmin } from "@/lib/push";
import { claimSlot, escapeHtml, adminBookingsUrl } from "@/lib/slots";
import { CONSENT_VERSION, hasPersonalDataConsent } from "@/lib/legal";
import { cleanText, enforceRateLimit, normalizeEmail, normalizePhone, readJsonObject } from "@/lib/request";
import { getAccountSession } from "@/lib/account-auth";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "book-bfm", 8, 60 * 60);
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? "Запрос слишком большой" : "Некорректный JSON" }, { status: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400 }); }
  const slot_id = cleanText(body.slot_id, 64);
  const client_name = cleanText(body.client_name, 120);
  const client_phone = normalizePhone(body.client_phone);
  const client_email = body.client_email ? normalizeEmail(body.client_email) : "";
  const consent = body.consent;
  const payment_option = body.payment_option === "at_appointment" ? "at_appointment" : "online";
  const session = await getAccountSession(request);

  if (!slot_id || !client_name || !client_phone) {
    return NextResponse.json({ error: "Поля слот, имя и телефон обязательны" }, { status: 400 });
  }
  if (!hasPersonalDataConsent(consent)) return NextResponse.json({ error: "Необходимо согласие на обработку персональных данных" }, { status: 400 });

  if (body.client_email && !client_email) return NextResponse.json({ error: "Укажите корректный e-mail" }, { status: 400 });
  const claimed = await claimSlot(slot_id, "bfm", {
      slot_id,
      client_name,
      client_phone,
      client_email: client_email || null,
      client_tg: null,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      account_user_id: session?.userId || null,
      payment_option,
      journey_promo_code:cleanText(body.promoCode,32),
      journey_request_key:cleanText(body.requestKey,64),journey_access_token:cleanText(body.accessToken,100),
      payment_status: payment_option === "at_appointment" ? "due" : "pending",
      status: payment_option === "at_appointment" ? "confirmed" : "pending",
    });
  if (!claimed.ok) {
    return NextResponse.json({ error: claimed.error }, { status: claimed.status });
  }
  const booking = claimed.booking;
  if (!claimed.created) return NextResponse.json({ok:true,linked_to_account:Boolean(session),booking},{headers:{'Cache-Control':'no-store'}});

  const date = new Date(claimed.slot.slot_time).toLocaleString("ru", { timeZone: "Europe/Moscow" });

  await sendTelegram(
    `<b>🟢 Новая заявка — Физическая реабилитация</b>\n\n` +
      `<b>Заявка:</b> ${escapeHtml(String(booking.id).slice(0, 8))}\n` +
      `<b>Дата:</b> ${escapeHtml(date)}\n` +
      `<b>Оплата:</b> ${payment_option === "at_appointment" ? "на приёме" : "онлайн"}\n\n` +
      `<a href="${adminBookingsUrl()}">Открыть в админке</a>`
  );

  await sendPushToAdmin("new_booking", `Физическая реабилитация, ${date}, заявка ${String(booking.id).slice(0, 8)}`).catch(()=>console.error('[Booking] Admin push unavailable'));
  return NextResponse.json({ ok: true, linked_to_account: Boolean(session), booking }, { status: 201,headers:{'Cache-Control':'no-store'} });
}
