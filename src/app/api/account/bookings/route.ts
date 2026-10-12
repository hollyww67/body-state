import { NextRequest, NextResponse } from "next/server";
import { getAccountSession } from "@/lib/account-auth";
import { cancelAccountBooking, rescheduleBooking, type ServiceType } from "@/lib/slots";
import { cleanText, readJsonObject } from "@/lib/request";
import {checkBookingRescheduleLimit} from '@/lib/booking-reschedule-rate';
import {loadJourney,validBookingId} from '@/lib/booking-journey';

const SERVICES = new Set<ServiceType>(["bfm", "brt", "psychology"]);

export async function PATCH(request: NextRequest) {
  const session = await getAccountSession(request);
  if (!session) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 4096); }
  catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const id = cleanText(body.id, 64);
  const serviceType = cleanText(body.service_type, 20) as ServiceType;
  const action = cleanText(body.action, 20);
  if (!validBookingId(id) || !SERVICES.has(serviceType)) return NextResponse.json({ error: "Запись не найдена" }, { status: 400 });

  try {
    if (action === "cancel") {
      const result = await cancelAccountBooking(id, serviceType, session.userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    if (action === "reschedule") {
      const owned=await loadJourney(serviceType as 'bfm'|'brt'|'psychology',id);
      if(!owned||owned.account_user_id!==session.userId)return NextResponse.json({error:'Запись не найдена'},{status:404});
      if(!await checkBookingRescheduleLimit(serviceType as 'bfm'|'brt'|'psychology',id)) return NextResponse.json({error:'Слишком много переносов. Повторите позже.'},{status:429,headers:{'Retry-After':'900'}});
      const slotId = cleanText(body.slot_id, 64);
      if (!slotId) return NextResponse.json({ error: "Выберите новое время" }, { status: 400 });
      const result = await rescheduleBooking({ bookingId: id, serviceType, newSlotId: slotId, accountUserId: session.userId });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, slot: result.slot });
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    console.error("[Account bookings] Update failed");
    return NextResponse.json({ error: "Не удалось изменить запись" }, { status: 500 });
  }
}
