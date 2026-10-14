import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/legal";
import { transitionOrderState } from "@/lib/order-stock";
import { claimManualPaymentLink, manualPaymentRequestKey, manualPaymentFingerprint, ManualPaymentConflict } from "@/lib/manual-payment-links";
import { cleanText, enforceRateLimit, normalizeEmail, normalizePhone, readJsonObject } from "@/lib/request";
import {
  createPaymentStatusToken,
  generateToken,
  PASSWORD,
  TERMINAL_KEY,
} from "@/lib/tbank";
import { requestTbank, paymentId, paymentErrorCode } from '@/lib/tbank-transport';
import { openPaymentCase } from '@/lib/payment-cases';

const TINKOFF_URL = process.env.TINKOFF_API_URL || "https://securepay.tinkoff.ru/v2/Init";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://body-state.ru";
const ALLOWED_LIFETIMES = new Set([1, 3, 7, 14, 30]);

type PaymentLinkRow = {
  id: string;
  items: Array<{ name?: string; price?: number; quantity?: number }>;
  total: number;
  status: string;
  receipt_email: string | null;
  loyalty_client_phone: string | null;
  loyalty_service_code: string | null;
  counts_as_visit: boolean;
  payment_id: string | null;
  payment_url: string | null;
  payment_link_expires_at: string | null;
  created_at: string;
};

function parseAmount(value: unknown) {
  const normalized = typeof value === "string"
    ? value.replace(/\s/g, "").replace(",", ".")
    : value;
  const amount = Number(normalized);
  const kopecks = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 10 || amount > 10_000_000 || kopecks <= 0) {
    return null;
  }
  return { rubles: kopecks / 100, kopecks };
}

function tbankDate(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function publicOrder(row: PaymentLinkRow) {
  const item = Array.isArray(row.items) ? row.items[0] : null;
  return {
    id: row.id,
    name: cleanText(item?.name, 128) || "Платёж по ссылке",
    amount: Number(row.total),
    email: row.receipt_email || "",
    phone: row.loyalty_client_phone || "",
    serviceCode: row.loyalty_service_code || "",
    countsAsVisit: row.counts_as_visit,
    status: row.status,
    paymentUrl: row.payment_url || "",
    paymentId: row.payment_id || "",
    expiresAt: row.payment_link_expires_at,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const { data, error } = await db
    .from<PaymentLinkRow>("orders")
    .select("id, items, total, status, receipt_email, loyalty_client_phone, loyalty_service_code, counts_as_visit, payment_id, payment_url, payment_link_expires_at, created_at")
    .eq("payment_method", "tinkoff_link")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Admin payment links] List error:", error.message);
    return NextResponse.json({ error: "Не удалось загрузить ссылки" }, { status: 500 });
  }

  return NextResponse.json(
    { links: (data || []).map(publicOrder) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "admin-payment-link", 60, 60 * 60);
  if (limited) return limited;

  let internalOrderId: string | null = null;
  try {
    if (!TERMINAL_KEY || !PASSWORD) {
      return NextResponse.json({ error: "Платёжный терминал не настроен" }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(request, 16_384);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
      return NextResponse.json(
        { error: tooLarge ? "Запрос слишком большой" : "Некорректный JSON" },
        { status: tooLarge ? 413 : 400 },
      );
    }

    const requestKey = manualPaymentRequestKey(body.requestKey);
    if (!requestKey) {
      return NextResponse.json({ error: "Для создания ссылки нужен ключ операции", code: "MANUAL_REQUEST_KEY_REQUIRED" }, { status: 400 });
    }
    const name = cleanText(body.name, 128);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const serviceCode = cleanText(body.serviceCode, 32);
    const allowedServices = new Set(["bfm", "brt", "psychology", "psychology_program"]);
    const amount = parseAmount(body.amount);
    const lifetimeDays = Number(body.lifetimeDays ?? 7);

    if (name.length < 2) {
      return NextResponse.json({ error: "Введите наименование платежа" }, { status: 400 });
    }
    if (!amount) {
      return NextResponse.json({ error: "Сумма должна быть от 10 ₽ до 10 000 000 ₽" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Введите корректный e-mail для чека" }, { status: 400 });
    }
    if (serviceCode && !allowedServices.has(serviceCode)) {
      return NextResponse.json({ error: "Выберите корректную процедуру" }, { status: 400 });
    }
    if (serviceCode && !phone) {
      return NextResponse.json({ error: "Для учёта посещения укажите корректный телефон клиента" }, { status: 400 });
    }
    if (!ALLOWED_LIFETIMES.has(lifetimeDays)) {
      return NextResponse.json({ error: "Некорректный срок действия ссылки" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000);
    // The administrator selects the client at issuance; never reassign on profile edits.
    const account = await pool.query<{ id: string }>(
      "SELECT id::text FROM account_users WHERE disabled_at IS NULL AND lower(email)=$1 AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g')=$2 LIMIT 1",
      [email, phone.replace(/\D/g, "")],
    );
    const claimed = await claimManualPaymentLink(requestKey, manualPaymentFingerprint({
      name, kopecks: amount.kopecks, email, phone, serviceCode, lifetimeDays,
    }), {
      client_name: "Плательщик по ссылке",
      client_phone: phone || "Не указан",
      address: "Не требуется",
      total: amount.rubles,
      receipt_email: email,
      receipt_phone: phone || null,
      payment_method: "tinkoff_link",
      payment_link_expires_at: expiresAt.toISOString(),
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      account_user_id: account.rows[0]?.id || null,
      loyalty_client_phone: phone || null,
      loyalty_service_code: serviceCode || null,
      counts_as_visit: Boolean(serviceCode && phone),
    }, { name, price: amount.rubles, quantity: 1 });
    if (!claimed.created) {
      return NextResponse.json({ success: true, link: publicOrder(claimed.order) });
    }
    const order = claimed.order;
    internalOrderId = String(order.id);

    const siteUrl = new URL(SITE_URL);
    if (siteUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS");
    }
    const successUrl = new URL("/payment/success", siteUrl);
    successUrl.searchParams.set("orderId", internalOrderId);
    successUrl.searchParams.set("token", createPaymentStatusToken(internalOrderId));

    const payload: Record<string, unknown> = {
      TerminalKey: TERMINAL_KEY,
      Amount: amount.kopecks,
      OrderId: internalOrderId,
      Description: name.slice(0, 140),
      CustomerKey: email || phone,
      Language: "ru",
      SuccessURL: successUrl.toString(),
      FailURL: new URL("/payment/fail", siteUrl).toString(),
      NotificationURL: new URL("/api/payment/callback", siteUrl).toString(),
      RedirectDueDate: tbankDate(expiresAt),
      Receipt: {
        Taxation: process.env.TINKOFF_TAXATION || "usn_income",
        Email: email,
        Phone: phone || undefined,
        Items: [{
          Name: name,
          Price: amount.kopecks,
          Quantity: 1,
          Amount: amount.kopecks,
          Tax: "none",
          PaymentMethod: "full_payment",
          PaymentObject: "service",
        }],
      },
    };
    payload.Token = generateToken(payload, PASSWORD);

    const response = await requestTbank(TINKOFF_URL, payload);
    const data = response.data;
    if (data?.Success === false) {
      await transitionOrderState(internalOrderId, "failed", { allowedFrom: ["pending"], paymentData: data });
      return NextResponse.json(
        { error: cleanText(data?.Message, 300) || "Платёжный сервис отклонил запрос" },
        { status: 502 },
      );
    }
    if (!response.ok || data?.Success !== true || typeof data.PaymentURL !== 'string') throw new Error('TBANK_UNKNOWN_OUTCOME');

    const paymentUrl = new URL(data.PaymentURL);
    if (paymentUrl.protocol !== "https:") throw new Error("Payment provider returned an unsafe URL");

    const { data: updated, error: updateError } = await db
      .from<PaymentLinkRow>("orders")
      .update({
        payment_id: paymentId(data.PaymentId),
        payment_url: paymentUrl.toString(),
        payment_link_expires_at: expiresAt.toISOString(),
      })
      .eq("id", internalOrderId)
      .select("id, items, total, status, receipt_email, loyalty_client_phone, loyalty_service_code, counts_as_visit, payment_id, payment_url, payment_link_expires_at, created_at")
      .single();

    if (updateError || !updated) {
      throw updateError || new Error("Payment link was not saved");
    }

    return NextResponse.json({ success: true, link: publicOrder(updated) });
  } catch (error) {
    if (error instanceof ManualPaymentConflict) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    console.error("[Admin payment links] Init error:", { code: paymentErrorCode(error), orderId: internalOrderId });
    if (internalOrderId) {
      await openPaymentCase(pool, internalOrderId, 'payment_init_uncertain').catch(() => null);
    }
    return NextResponse.json({ error: "Не удалось сформировать ссылку на оплату" }, { status: 500 });
  }
}
