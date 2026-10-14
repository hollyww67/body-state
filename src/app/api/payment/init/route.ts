import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { createPaymentStatusToken, generateToken, TERMINAL_KEY, PASSWORD } from "@/lib/tbank";
import { CONSENT_VERSION, hasPersonalDataConsent } from "@/lib/legal";
import { cleanText, enforceRateLimit, normalizeEmail, normalizePhone, readJsonObject } from "@/lib/request";
import { createPendingOrderWithReservation, transitionOrderState, type OrderItem } from "@/lib/order-stock";
import { getAccountSession } from "@/lib/account-auth";
import { getServicePrice } from "@/lib/service-prices";
import { isPayableBookingType } from "@/lib/booking-payments";
import { normalizePromoCode, type PromoServiceCode, validatePromoCode } from "@/lib/promo-codes";
import { loadJourney, matchesAccessToken, validBookingId, type JourneySnapshot } from '@/lib/booking-journey';
import { openPaymentCase } from '@/lib/payment-cases';
import { requestTbank, paymentId, paymentErrorCode } from '@/lib/tbank-transport';

const TINKOFF_URL = process.env.TINKOFF_API_URL || "https://securepay.tinkoff.ru/v2/Init";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://body-state.ru";

type PaymentItem = {
  productId?: unknown;
  quantity?: unknown;
  bookingId?: unknown;
  bookingType?: unknown;
  serviceCode?: unknown;
};

type NormalizedPaymentItem = Omit<PaymentItem, "productId" | "bookingId" | "bookingType"> & {
  productId: string;
  bookingId: string;
  bookingType: string;
};

function normalizePaymentItem(value: unknown): NormalizedPaymentItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректная позиция заказа");
  const item = value as PaymentItem;
  return {
    ...item,
    productId: cleanText(item.productId, 64),
    bookingId: cleanText(item.bookingId, 64).toLowerCase(),
    bookingType: cleanText(item.bookingType, 20),
  };
}

type ResolvedItem = OrderItem & {
  name: string;
  price: number;
  quantity: number;
  paymentObject: "commodity" | "service";
  promoServiceCode?: PromoServiceCode;
};

function rublesToKopecks(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Некорректная сумма");
  return Math.round(value * 100);
}

function quantityOf(value: unknown) {
  const quantity = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new Error("Некорректное количество товара");
  }
  return quantity;
}

async function resolveItemsFromDb(items: NormalizedPaymentItem[]): Promise<ResolvedItem[]> {
  if (items.length > 30) throw new Error("Слишком много позиций");
  const resolved: ResolvedItem[] = [];

  for (const item of items) {
    const quantity = quantityOf(item.quantity);
    const productId = item.productId;

    if (productId) {
      const { data: product } = await db.from("products").select("id, name, price, stock").eq("id", productId).eq("is_active", true).maybeSingle();
      if (!product) throw new Error("Товар не найден");
      if (Number(product.stock) < quantity) throw new Error(`Недостаточно товара: ${product.name}`);
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error("Некорректная цена товара");
      resolved.push({ productId: String(product.id), name: String(product.name).slice(0, 128), price, quantity, paymentObject: "commodity" });
      continue;
    }

    const { bookingId, bookingType } = item;
    if (bookingId && isPayableBookingType(bookingType)) {
      const table = bookingType === "bfm" ? "bfm_bookings" : bookingType === "brt" ? "brt_bookings" : "psychology_bookings";
      const fields = bookingType === "psychology" ? "id, status, program_id, journey_snapshot" : "id, status, journey_snapshot";
      const { data: booking } = await db.from(table).select(fields).eq("id", bookingId).eq("status", "pending").maybeSingle();
      if (!booking) throw new Error("Запись не найдена или уже оплачена");
      const snapshot=booking.journey_snapshot as JourneySnapshot|null;
      if(snapshot){resolved.push({name:snapshot.title,price:snapshot.subtotal,quantity:1,bookingId,bookingType,paymentObject:'service',promoServiceCode:booking.program_id?'psychology_program':bookingType});continue;}

      if (bookingType === "psychology" && booking.program_id) {
        const { data: program } = await db.from("psychology_programs").select("id, title, price").eq("id", booking.program_id).eq("is_active", true).maybeSingle();
        if (!program) throw new Error("Программа недоступна");
        const price = Number(program.price);
        if (!Number.isFinite(price) || price <= 0) throw new Error("Цена программы не настроена");
        resolved.push({ name: String(program.title).slice(0, 128), price, quantity: 1, bookingId, bookingType, paymentObject: "service", promoServiceCode: "psychology_program" });
        continue;
      }

      const service = await getServicePrice(bookingType);
      if (!service.is_active || service.price <= 0) throw new Error("Цена услуги не настроена");
      resolved.push({ name: service.label.slice(0, 128), price: service.price, quantity: 1, bookingId, bookingType, paymentObject: "service", promoServiceCode: bookingType === "bfm" ? "bfm" : bookingType === "brt" ? "brt" : bookingType === "psychology" ? "psychology" : undefined });
      continue;
    }

    if (item.serviceCode === "recovery-program") {
      const service = await getServicePrice("recovery-program");
      if (!service.is_active || service.price <= 0) throw new Error("Цена программы не настроена");
      resolved.push({ name: service.label.slice(0, 128), price: service.price, quantity: 1, paymentObject: "service" });
      continue;
    }

    throw new Error("Неизвестная позиция заказа");
  }
  return resolved;
}

function receiptItems(items: ResolvedItem[], discountAmount = 0) {
  return items.map((item, index) => {
    const itemDiscount = index === 0 ? discountAmount : 0;
    const price = rublesToKopecks(item.price - itemDiscount);
    return { Name: item.name, Price: price, Quantity: item.quantity, Amount: price * item.quantity, Tax: "none", PaymentMethod: "full_payment", PaymentObject: item.paymentObject };
  });
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "payment-init", 12, 60 * 60);
  if (limited) return limited;

  let internalOrderId: string | null = null;
  let stage = 'validation';
  let caseBooking:{id:string;service:string}|undefined;
  try {
    if (!TERMINAL_KEY || !PASSWORD) return NextResponse.json({ success: false, error: "Платежный терминал не настроен" }, { status: 503 });

    let body: Record<string, unknown>;
    try {
      body = await readJsonObject(request, 48_000);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
      return NextResponse.json({ success: false, error: tooLarge ? "Запрос слишком большой" : "Некорректный JSON" }, { status: tooLarge ? 413 : 400 });
    }
    if (!hasPersonalDataConsent(body.consent)) return NextResponse.json({ success: false, error: "Необходимо согласие на обработку персональных данных" }, { status: 400 });

    const externalOrderId = cleanText(body.orderId, 128);
    if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(externalOrderId)) return NextResponse.json({ success: false, error: "Некорректный идентификатор заказа" }, { status: 400 });
    if (!Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ success: false, error: "Заказ пуст" }, { status: 400 });

    let items: NormalizedPaymentItem[];
    try {
      if (body.items.length > 30) throw new Error("Слишком много позиций");
      items = body.items.map(normalizePaymentItem);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Ошибка состава заказа" }, { status: 400 });
    }

    let email = normalizeEmail(body.customerEmail);
    let phone = normalizePhone(body.customerPhone);
    const accountSession = await getAccountSession(request);
    for(const item of items) {
      if(isPayableBookingType(item.bookingType)) {
        if(!validBookingId(item.bookingId))return NextResponse.json({error:'Запись недоступна'},{status:400});
        const b=await loadJourney(item.bookingType,item.bookingId);
        if(!b || !(accountSession?.userId && b.account_user_id===accountSession.userId) && !matchesAccessToken(String(body.bookingAccessToken||''),b.access_hash))return NextResponse.json({error:'Требуется доступ к записи'},{status:403});
        if(b.hold_expires_at && new Date(b.hold_expires_at)<=new Date())return NextResponse.json({error:'Срок временной брони истёк'},{status:409});
        if(items.length===1){email=normalizeEmail(b.client_email);phone=normalizePhone(b.client_phone);body.customerName=b.client_name;}
      }
    }
    if (!email && !phone) return NextResponse.json({ success: false, error: "Укажите email или телефон для чека" }, { status: 400 });

    let resolved: ResolvedItem[];
    try {
      resolved = await resolveItemsFromDb(items);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Ошибка состава заказа" }, { status: 400 });
    }

    const subtotalRubles = resolved.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if(resolved.length===1&&resolved[0].bookingId)caseBooking={id:resolved[0].bookingId,service:String(resolved[0].bookingType)};
    const promoCode = normalizePromoCode(body.promoCode);
    let promo: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
    if (promoCode) {
      if (resolved.length !== 1 || resolved[0].quantity !== 1 || !resolved[0].promoServiceCode) {
        return NextResponse.json({ success: false, error: "Промокоды действуют только на отдельные процедуры" }, { status: 400 });
      }
      try {
        promo = await validatePromoCode(promoCode, resolved[0].promoServiceCode, subtotalRubles, accountSession?.userId);
      } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Промокод не применён" }, { status: 400 });
      }
    }
    const discountAmount = promo?.discount || 0;
    const totalRubles = Math.round((subtotalRubles - discountAmount) * 100) / 100;
    const amountInKopecks = rublesToKopecks(totalRubles);
    for(const item of resolved){if(item.bookingId && isPayableBookingType(item.bookingType)){
      const b=await loadJourney(item.bookingType,item.bookingId),snapshot=b?.journey_snapshot as JourneySnapshot|null;
      if(snapshot && (snapshot.total!==totalRubles || (snapshot.promoCode||'')!==promoCode))return NextResponse.json({error:'Условия сохранённой записи отличаются. Используйте её итоговую стоимость и промокод.'},{status:409});
      const existing=await pool.query(`SELECT id,payment_url,status FROM orders o WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) i WHERE lower(i->>'bookingId')=$1 AND i->>'bookingType'=$2) AND status='pending' ORDER BY created_at DESC LIMIT 1`,[item.bookingId,item.bookingType]);
      if(existing.rows[0])return existing.rows[0].payment_url?NextResponse.json({success:true,paymentUrl:existing.rows[0].payment_url,orderId:existing.rows[0].id}):NextResponse.json({error:'Платёж создаётся или требует проверки. Не создавайте новую запись.'},{status:409});
    }}
    const displayedAmount = Number(body.amount);
    if (!Number.isFinite(displayedAmount) || displayedAmount <= 0 || rublesToKopecks(displayedAmount) !== amountInKopecks) {
      return NextResponse.json({ success: false, error: "Цена изменилась. Обновите страницу перед оплатой." }, { status: 409 });
    }
    const orderItems: OrderItem[] = resolved.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      bookingId: item.bookingId,
      bookingType: item.bookingType,
    }));
    let order;
    stage = 'reserve_order';
    try {
      order = await createPendingOrderWithReservation({
        external_order_id: resolved.some(i=>i.bookingId)?`${externalOrderId.slice(0,85)}-${crypto.randomUUID()}`:externalOrderId,
        client_name: cleanText(body.customerName, 120) || "Покупатель",
        client_phone: phone || "Не указан",
        address: cleanText(body.address, 500) || "Не указан",
        total: totalRubles,
        receipt_email: email || null,
        receipt_phone: phone || null,
        consent_version: CONSENT_VERSION,
        consent_at: new Date().toISOString(),
        account_user_id: accountSession?.userId || null,
        subtotal: subtotalRubles,
        discount_amount: discountAmount,
        promo_code_id: promo?.promo.id || null,
        promo_service_code: resolved[0]?.promoServiceCode || null,
      }, orderItems);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") return NextResponse.json({ success: false, error: "Этот заказ уже был создан" }, { status: 409 });
      if (error instanceof Error && error.message.startsWith("BOOKING_")) return NextResponse.json({ success: false, error: "Для записи уже создан платёж или время больше недоступно. Обновите страницу." }, { status: 409 });
      if (error instanceof Error && error.message === "OUT_OF_STOCK") return NextResponse.json({ success: false, error: "Товар закончился или остаток изменился" }, { status: 409 });
      if (error instanceof Error && error.message.startsWith("PROMO_")) return NextResponse.json({ success: false, error: "Промокод изменился или его лимит исчерпан. Примените код ещё раз." }, { status: 409 });
      throw error;
    }
    internalOrderId = String(order.id);
    stage = 'prepare_payload';

    const siteUrl = new URL(SITE_URL);
    if (siteUrl.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS");
    const successUrl = new URL("/payment/success", siteUrl);
    successUrl.searchParams.set("orderId", internalOrderId);
    successUrl.searchParams.set("token", createPaymentStatusToken(internalOrderId));
    const payload: Record<string, unknown> = {
      TerminalKey: TERMINAL_KEY,
      Amount: amountInKopecks,
      OrderId: internalOrderId,
      Description: resolved.map((item) => item.name).join(", ").slice(0, 140),
      CustomerKey: email || phone,
      Language: "ru",
      SuccessURL: successUrl.toString(),
      FailURL: new URL("/payment/fail", siteUrl).toString(),
      NotificationURL: new URL("/api/payment/callback", siteUrl).toString(),
      Receipt: { Taxation: process.env.TINKOFF_TAXATION || "usn_income", Items: receiptItems(resolved, discountAmount), ...(email ? { Email: email } : {}), ...(phone ? { Phone: phone } : {}) },
    };
    payload.Token = generateToken(payload, PASSWORD);

    stage = 'bank_init';
    const response = await requestTbank(TINKOFF_URL, payload);
    const data = response.data;
    if (data?.Success === false) {
      await transitionOrderState(internalOrderId, "failed", { allowedFrom: ["pending"], releaseStock: true, paymentData: data });
      // A rejected Init leaves the saved booking available for retry until its hold expires.
      return NextResponse.json({ success: false, error: cleanText(data?.Message, 300) || "Платежный сервис отклонил запрос" }, { status: 502 });
    }
    if (!response.ok || data?.Success !== true || typeof data.PaymentURL !== 'string') throw new Error('TBANK_UNKNOWN_OUTCOME');

    const paymentUrl = new URL(data.PaymentURL);
    if (paymentUrl.protocol !== "https:") throw new Error("Payment provider returned an unsafe URL");
    stage = 'save_payment';
    const { error: updateError } = await db.from("orders").update({ payment_id: paymentId(data.PaymentId), payment_url: paymentUrl.toString() }).eq("id", internalOrderId);
    if (updateError) {
      // The bank may already have accepted Init. Do not free the order for another Init.
      throw updateError;
    }

    return NextResponse.json({ success: true, paymentUrl: paymentUrl.toString(), paymentId: data.PaymentId, orderId: internalOrderId, amount: amountInKopecks, discount: discountAmount, promoCode: promo?.promo.code || null });
  } catch (error) {
    console.error("[T-Bank] Init outcome requires review", { stage, code: paymentErrorCode(error), orderId: internalOrderId });
    if (internalOrderId) {
      // A timeout can occur after the bank accepted Init: require review, never create a second payment blindly.
      await openPaymentCase(pool,internalOrderId,'payment_init_uncertain',caseBooking?.id,caseBooking?.service).catch(()=>null);
    }
    return NextResponse.json({ success: false, error: "Не удалось создать платеж" }, { status: 500 });
  }
}
