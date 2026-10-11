import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";
import { CONSENT_VERSION, hasPersonalDataConsent } from "@/lib/legal";
import { cleanMultiline, cleanText, enforceRateLimit, normalizePhone, readJsonObject } from "@/lib/request";
import { getAccountSession } from "@/lib/account-auth";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "program", 5, 60 * 60);
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? "Запрос слишком большой" : "Некорректный JSON" }, { status: error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 400 }); }
  const client_name = cleanText(body.client_name, 120);
  const client_phone = normalizePhone(body.client_phone);
  const notes = cleanMultiline(body.notes, 1500);
  const consent = body.consent;
  const session = await getAccountSession(request);

  if (!client_name || !client_phone) {
    return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 });
  }
  if (!hasPersonalDataConsent(consent)) return NextResponse.json({ error: "Необходимо согласие на обработку персональных данных" }, { status: 400 });

  const { data, error } = await db.from("program_enrollments").insert({
    client_name,
    client_phone,
    notes: notes || null,
    consent_version: CONSENT_VERSION,
    consent_at: new Date().toISOString(),
    account_user_id: session?.userId || null,
  }).select("id").single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Не удалось создать заявку" }, { status: 500 });
  }

  await sendTelegram(
    `⭐ <b>Новая заявка — Комплексная программа</b>\n\n` +
    `Заявка: ${String(data.id).slice(0, 8)}\n` +
    `\n<a href="https://body-state.ru/admin/bookings">Открыть заявки</a>`
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
