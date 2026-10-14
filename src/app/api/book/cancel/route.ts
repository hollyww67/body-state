import { NextRequest, NextResponse } from "next/server";
import { isPayableBookingType } from "@/lib/booking-payments";
import { cancelUnpaidHold } from '@/lib/slots';
import { getAccountSession } from '@/lib/account-auth';
import { loadJourney, matchesAccessToken, validBookingId } from '@/lib/booking-journey';
import { pool } from '@/lib/db';
import { cleanText, enforceRateLimit, normalizePhone, readJsonObject } from "@/lib/request";

/** Releases a booking when payment initialization fails before redirect. */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "cancel-booking-payment", 10, 60 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8_192); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }

  const bookingId = cleanText(body.bookingId, 64).toLowerCase();
  const bookingType = cleanText(body.bookingType, 20);
  const phone = normalizePhone(body.client_phone);
  if (!validBookingId(bookingId) || !isPayableBookingType(bookingType) || !phone) {
    return NextResponse.json({ error: "Некорректные данные бронирования" }, { status: 400 });
  }

  try {
    const session = await getAccountSession(request);
    const booking = await loadJourney(bookingType, bookingId);
    const token = typeof body.accessToken === 'string' ? body.accessToken : '';
    if (!booking || !(session?.userId && booking.account_user_id === session.userId) && !matchesAccessToken(token, booking.access_hash)) {
      return NextResponse.json({ error: 'Требуется доступ к записи' }, { status: 403 });
    }
    // Preserve the unpaid-only boundary for historical orders with uppercase UUIDs.
    // The hold transaction still checks concurrently created canonical orders under its lock.
    const payment = await pool.query(`SELECT 1 FROM orders o, jsonb_array_elements(o.items) item
      WHERE lower(item->>'bookingId')=$1 AND item->>'bookingType'=$2
        AND o.status IN ('pending','paid','shipped','delivered') LIMIT 1`, [bookingId, bookingType]);
    if (payment.rowCount) return NextResponse.json({ error: 'Для записи уже создан платёж' }, { status: 409 });
    const result = await cancelUnpaidHold(bookingId, bookingType, phone);
    return NextResponse.json(result.ok ? {ok:true} : {error:result.error}, {status:result.status});
  } catch (error) {
    console.error('[Cancel hold]', error);
    return NextResponse.json({error:'Не удалось отменить запись'}, {status:500});
  }
}
