import { NextRequest, NextResponse } from "next/server";
import { isPayableBookingType } from "@/lib/booking-payments";
import { cancelUnpaidHold } from '@/lib/slots';
import { cleanText, enforceRateLimit, normalizePhone, readJsonObject } from "@/lib/request";

/** Releases a booking when payment initialization fails before redirect. */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "cancel-booking-payment", 10, 60 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8_192); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }

  const bookingId = cleanText(body.bookingId, 64);
  const bookingType = cleanText(body.bookingType, 20);
  const phone = normalizePhone(body.client_phone);
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !isPayableBookingType(bookingType) || !phone) {
    return NextResponse.json({ error: "Некорректные данные бронирования" }, { status: 400 });
  }

  try {
    const result = await cancelUnpaidHold(bookingId, bookingType, phone);
    return NextResponse.json(result.ok ? {ok:true} : {error:result.error}, {status:result.status});
  } catch (error) {
    console.error('[Cancel hold]', error);
    return NextResponse.json({error:'Не удалось отменить запись'}, {status:500});
  }
}
