import { db } from "@/lib/db";
import type { PoolClient } from "pg";
import { createBookingAccess, createJourneySnapshot, publicJourney, hashAccessToken,matchesAccessToken,validBookingId, type BookingJourney } from '@/lib/booking-journey';
import { enqueueAppointment, invalidateAppointmentNotifications, scheduleReminder } from '@/lib/appointment-notifications';
import { findBookingPaymentCases } from '@/lib/payment-cases';

export type ServiceType = "bfm" | "brt" | "psychology";

export type ClaimedSlot = {
  id: string;
  slot_time: string;
  service_type: string;
  duration_minutes: number;
  is_booked?: boolean;
};

export const SERVICE_DURATION_MINUTES: Record<ServiceType, number> = {
  bfm: 90,
  brt: 60,
  psychology: 90,
};

const BOOKING_TABLES = ["bfm_bookings", "brt_bookings", "psychology_bookings"] as const;
export type BookingTable = typeof BOOKING_TABLES[number];

function tableForService(serviceType: ServiceType): BookingTable {
  return serviceType === "bfm" ? "bfm_bookings" : serviceType === "brt" ? "brt_bookings" : "psychology_bookings";
}

const activeAppointmentsSql = BOOKING_TABLES.map((table) => `
  SELECT b.id::text AS booking_id, b.slot_id, s.slot_time, s.duration_minutes
    FROM ${table} b
    JOIN slots s ON s.id = b.slot_id
   WHERE b.status NOT IN ('cancelled', 'completed')
`).join(" UNION ALL ");

export async function refreshSlotOccupancy(client: PoolClient) {
  await client.query("UPDATE slots SET is_booked=false");
  await client.query(`
    WITH active AS (${activeAppointmentsSql})
    UPDATE slots candidate
       SET is_booked=true
     WHERE EXISTS (
       SELECT 1 FROM active appointment
        WHERE tstzrange(candidate.slot_time, candidate.slot_time + candidate.duration_minutes * interval '1 minute', '[)')
           && tstzrange(appointment.slot_time, appointment.slot_time + appointment.duration_minutes * interval '1 minute', '[)')
     ) OR EXISTS (
       SELECT 1 FROM schedule_breaks pause
        WHERE tstzrange(candidate.slot_time, candidate.slot_time + candidate.duration_minutes * interval '1 minute', '[)')
           && tstzrange(pause.starts_at, pause.ends_at, '[)')
     )
  `);
}

export async function refreshScheduleOccupancy(): Promise<void> {
  await db.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
    await refreshSlotOccupancy(client);
  });
}

/**
 * Atomically claims a slot and blocks every overlapping slot across all services.
 * A transaction-level advisory lock serializes competing booking attempts.
 */
export async function claimSlot(
  slotId: string,
  serviceType: ServiceType,
  bookingFields: Record<string, unknown>,
): Promise<{ ok: true; created:boolean; slot: ClaimedSlot; booking: { id: string; status: string; summary:BookingJourney; accessToken:string } } | { ok: false; error: string; status: number }> {
  try {
    return await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      const requestKey=validBookingId(String(bookingFields.journey_request_key))?String(bookingFields.journey_request_key):null;
      const suppliedToken=String(bookingFields.journey_access_token||'');
      const access=/^[A-Za-z0-9_-]{43}$/.test(suppliedToken)?{token:suppliedToken,hash:hashAccessToken(suppliedToken)}:createBookingAccess();
      if(requestKey){
        const previous=await client.query(`SELECT b.*,s.slot_time,s.duration_minutes,s.service_type FROM ${tableForService(serviceType)} b JOIN slots s ON s.id=b.slot_id WHERE b.request_key=$1`,[requestKey]);
        const b=previous.rows[0];
        if(b){
          if(!matchesAccessToken(access.token,b.access_hash))return {ok:false as const,error:'Повторный запрос недоступен',status:409};
          return {ok:true as const,created:false,slot:{id:b.slot_id,slot_time:b.slot_time,service_type:serviceType,duration_minutes:b.duration_minutes},booking:{id:b.id,status:b.status,summary:publicJourney(serviceType,b),accessToken:access.token}};
        }
      }
      const result = await client.query<ClaimedSlot>(
        `SELECT id::text, slot_time::text, service_type, duration_minutes, is_booked
           FROM slots
          WHERE id=$1 AND service_type=$2 AND slot_time > now()
          FOR UPDATE`,
        [slotId, serviceType],
      );
      const slot = result.rows[0];
      if (!slot) return { ok: false as const, error: "Время не найдено или уже прошло", status: 409 };
      if (slot.is_booked) return { ok: false as const, error: "Это время уже занято", status: 409 };

      const conflict = await client.query(`
        WITH active AS (${activeAppointmentsSql})
        SELECT 1 FROM (
          SELECT appointment.slot_time AS starts_at, appointment.slot_time + appointment.duration_minutes * interval '1 minute' AS ends_at FROM active appointment
          UNION ALL
          SELECT pause.starts_at, pause.ends_at FROM schedule_breaks pause
        ) blocked
         WHERE tstzrange($1::timestamptz, $1::timestamptz + $2::int * interval '1 minute', '[)')
            && tstzrange(blocked.starts_at, blocked.ends_at, '[)')
         LIMIT 1`,
        [slot.slot_time, slot.duration_minutes],
      );
      if (conflict.rowCount) return { ok: false as const, error: "Это время пересекается с другой записью", status: 409 };

      await client.query(`
        UPDATE slots candidate
           SET is_booked=true
         WHERE tstzrange(candidate.slot_time, candidate.slot_time + candidate.duration_minutes * interval '1 minute', '[)')
            && tstzrange($1::timestamptz, $1::timestamptz + $2::int * interval '1 minute', '[)')`,
        [slot.slot_time, slot.duration_minutes],
      );
      // Keep slot occupancy and its booking in the same transaction. Otherwise a
      // concurrent schedule refresh can clear the claim before the booking exists.
      // Every snapshot query must reuse this client: pool waiters hold connections
      // while awaiting the scheduling lock, so borrowing again can exhaust the pool.
      const snapshot=await createJourneySnapshot(serviceType,bookingFields,slot.duration_minutes,client);
      const savedFields={...bookingFields};delete savedFields.journey_promo_code;delete savedFields.journey_request_key;delete savedFields.journey_access_token;
      const entries = Object.entries({ ...savedFields, slot_id: slotId,journey_snapshot:snapshot,access_hash:access.hash,
        request_key:requestKey,hold_expires_at:bookingFields.status==='confirmed'?null:new Date(Date.now()+10*60000).toISOString() });
      const columns = entries.map(([key]) => {
        if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid booking field");
        return `"${key}"`;
      });
      const booking = await client.query(
        `INSERT INTO ${tableForService(serviceType)} (${columns.join(",")})
         VALUES (${entries.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
        entries.map(([, value]) => value),
      );
      const b=booking.rows[0];
      await enqueueAppointment(client,serviceType,b.id,b.status==='confirmed'?'confirmed':'created');
      await scheduleReminder(client,serviceType,b.id);
      return { ok: true as const, created:true, slot, booking: {id:b.id,status:b.status,summary:publicJourney(serviceType,{...b,slot_time:slot.slot_time}),accessToken:access.token} };
    });
  } catch (error) {
    console.error("[Booking] Could not reserve appointment");
    if(error instanceof Error && /^(Промокод|Программа|Цена услуги)/.test(error.message))return {ok:false,error:error.message,status:400};
    return { ok: false, error: "Не удалось создать запись. Попробуйте ещё раз.", status: 500 };
  }
}

/** Release a slot and siblings at the same time if no other active bookings remain. */
export async function releaseSlotTime(slotId: string): Promise<void> {
  void slotId;
  await db.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
    await refreshSlotOccupancy(client);
  });
}

export async function rescheduleBooking(args: {
  bookingId: string;
  serviceType: ServiceType;
  newSlotId: string;
  accountUserId?: string;
}) {
  const table = tableForService(args.serviceType);
  try {
    return await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      const booking = await client.query<{ id: string; status: string }>(
        `SELECT id::text, status FROM ${table} WHERE id=$1${args.accountUserId ? " AND account_user_id=$2" : ""} FOR UPDATE`,
        args.accountUserId ? [args.bookingId, args.accountUserId] : [args.bookingId],
      );
      if (!booking.rows[0]) return { ok: false as const, error: "Запись не найдена", status: 404 };
      if (["cancelled", "completed"].includes(booking.rows[0].status)) return { ok: false as const, error: "Эту запись уже нельзя перенести", status: 409 };

      const slotResult = await client.query<ClaimedSlot>(
        `SELECT id::text, slot_time::text, service_type, duration_minutes FROM slots WHERE id=$1 AND service_type=$2 AND slot_time > now() FOR UPDATE`,
        [args.newSlotId, args.serviceType],
      );
      const slot = slotResult.rows[0];
      if (!slot) return { ok: false as const, error: "Новое время не найдено", status: 404 };

      const conflict = await client.query(`
        WITH active AS (${activeAppointmentsSql})
        SELECT 1 FROM (
          SELECT appointment.slot_time AS starts_at, appointment.slot_time + appointment.duration_minutes * interval '1 minute' AS ends_at
            FROM active appointment WHERE appointment.booking_id <> $3
          UNION ALL
          SELECT pause.starts_at, pause.ends_at FROM schedule_breaks pause
        ) blocked
         WHERE tstzrange($1::timestamptz, $1::timestamptz + $2::int * interval '1 minute', '[)')
            && tstzrange(blocked.starts_at, blocked.ends_at, '[)')
         LIMIT 1`,
        [slot.slot_time, slot.duration_minutes, args.bookingId],
      );
      if (conflict.rowCount) return { ok: false as const, error: "Новое время уже занято", status: 409 };

      await client.query(`UPDATE ${table} SET slot_id=$2, rescheduled_at=now(), reminder_sent_at=NULL, updated_at=now() WHERE id=$1`, [args.bookingId, args.newSlotId]);
      await client.query(`UPDATE ${table} SET journey_snapshot=jsonb_set(journey_snapshot,'{duration}',to_jsonb($2::int)) WHERE id=$1 AND journey_snapshot IS NOT NULL`,[args.bookingId,slot.duration_minutes]);
      await invalidateAppointmentNotifications(client,args.serviceType,args.bookingId);
      await enqueueAppointment(client,args.serviceType,args.bookingId,'rescheduled');
      await scheduleReminder(client,args.serviceType,args.bookingId);
      await refreshSlotOccupancy(client);
      return { ok: true as const, slot };
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось перенести запись", status: 500 };
  }
}

export async function createScheduleBreak(args: { startsAt: string; endsAt: string; reason: string }) {
  try {
    return await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      const appointmentConflict = await client.query(`
        WITH active AS (${activeAppointmentsSql})
        SELECT 1 FROM active appointment
         WHERE tstzrange($1::timestamptz, $2::timestamptz, '[)')
            && tstzrange(appointment.slot_time, appointment.slot_time + appointment.duration_minutes * interval '1 minute', '[)')
         LIMIT 1`, [args.startsAt, args.endsAt]);
      if (appointmentConflict.rowCount) return { ok: false as const, error: "На это время уже записан клиент. Сначала перенесите или отмените запись.", status: 409 };

      const breakConflict = await client.query(
        `SELECT 1 FROM schedule_breaks WHERE tstzrange($1::timestamptz, $2::timestamptz, '[)') && tstzrange(starts_at, ends_at, '[)') LIMIT 1`,
        [args.startsAt, args.endsAt],
      );
      if (breakConflict.rowCount) return { ok: false as const, error: "Этот интервал пересекается с другим перерывом", status: 409 };

      const inserted = await client.query<{ id: string; starts_at: string; ends_at: string; reason: string }>(
        `INSERT INTO schedule_breaks (starts_at, ends_at, reason) VALUES ($1,$2,$3) RETURNING id::text, starts_at::text, ends_at::text, reason`,
        [args.startsAt, args.endsAt, args.reason],
      );
      await refreshSlotOccupancy(client);
      return { ok: true as const, scheduleBreak: inserted.rows[0] };
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось создать перерыв", status: 500 };
  }
}

export async function deleteScheduleBreak(id: string) {
  try {
    return await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      const deleted = await client.query("DELETE FROM schedule_breaks WHERE id=$1 RETURNING id", [id]);
      if (!deleted.rowCount) return { ok: false as const, error: "Перерыв не найден", status: 404 };
      await refreshSlotOccupancy(client);
      return { ok: true as const };
    });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось удалить перерыв", status: 500 };
  }
}

export async function cancelAccountBooking(bookingId: string, serviceType: ServiceType, accountUserId: string|undefined) {
  const table = tableForService(serviceType);
  return db.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
    const result = await client.query(
      `UPDATE ${table} SET status='cancelled', updated_at=now() WHERE id=$1 ${accountUserId?'AND account_user_id=$2':''} AND status NOT IN ('cancelled','completed') RETURNING id`,
      accountUserId?[bookingId, accountUserId]:[bookingId],
    );
    if (!result.rowCount) return { ok: false as const, error: "Запись не найдена или уже закрыта", status: 409 };
    await invalidateAppointmentNotifications(client,serviceType,bookingId);
    await enqueueAppointment(client,serviceType,bookingId,'cancelled');
    await findBookingPaymentCases(bookingId,serviceType,client);
    await refreshSlotOccupancy(client);
    return { ok: true as const };
  });
}

export async function cancelUnpaidHold(bookingId: string, serviceType: ServiceType, phone: string) {
  return db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [913202609]);
    const table = tableForService(serviceType);
    const found = await client.query(`SELECT status, client_phone FROM ${table} WHERE id=$1 FOR UPDATE`, [bookingId]);
    const booking = found.rows[0];
    if (!booking || String(booking.client_phone).replace(/\D/g,'').slice(-10) !== phone.replace(/\D/g,'').slice(-10)) return { ok: false, status: 404, error: 'Запись не найдена' };
    if (booking.status !== 'pending') return { ok: false, status: 409, error: 'Запись уже обработана' };
    const payment = await client.query(`SELECT 1 FROM orders o, jsonb_array_elements(o.items) item
      WHERE item->>'bookingId'=$1 AND item->>'bookingType'=$2 AND o.status IN ('pending','paid','shipped','delivered') LIMIT 1`, [bookingId,serviceType]);
    if (payment.rowCount) return { ok: false, status: 409, error: 'Для записи уже создан платёж' };
    await client.query(`UPDATE ${table} SET status='cancelled', updated_at=now() WHERE id=$1`, [bookingId]);
    await invalidateAppointmentNotifications(client,serviceType,bookingId);
    await enqueueAppointment(client,serviceType,bookingId,'cancelled');
    await refreshSlotOccupancy(client);
    return { ok: true, status: 200 };
  });
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function adminBookingsUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://body-state.ru";
  return `${base.replace(/\/$/, "")}/admin/bookings`;
}
