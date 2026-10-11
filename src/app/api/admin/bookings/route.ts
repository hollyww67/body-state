import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { claimSlot, rescheduleBooking, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";
import { CONSENT_VERSION } from "@/lib/legal";
import { cleanText, normalizePhone, readJsonObject } from "@/lib/request";
import { updateAdminBooking, BookingActionError } from "@/lib/admin-bookings";

export async function GET() {
  const { data: bfm } = await db.from("bfm_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, attendance, payment_option, payment_status, created_at, slot_id, consent_version, consent_at, account_user_id").order("created_at", { ascending: false });
  const { data: brt } = await db.from("brt_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, attendance, payment_option, payment_status, created_at, slot_id, consent_version, consent_at, account_user_id").order("created_at", { ascending: false });
  const { data: psy } = await db.from("psychology_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, attendance, payment_option, payment_status, booking_type, room_id, program_id, created_at, slot_id, consent_version, consent_at, account_user_id").order("created_at", { ascending: false });
  const { data: program } = await db.from("program_enrollments")
    .select("id, client_name, client_phone, notes, status, attendance, created_at, consent_version, consent_at, account_user_id").order("created_at", { ascending: false });
  const { data: consultation } = await db.from("consultation_enrollments")
    .select("id, name, phone, message, source, service_type, status, attendance, created_at, consent_version, consent_at, account_user_id").order("created_at", { ascending: false });

  const allSlots = await db.from("slots").select("id, slot_time");
  const slotMap = new Map((allSlots.data || []).map((s: any) => [s.id, s.slot_time]));

  const mapBookings = (list: any[] | null, type: string) => {
    if (!list) return [];
    return list.map((b: any) => ({ ...b, service_type: type, slot_time: slotMap.get(b.slot_id) || null }));
  };

  const programBookings = (program || []).map((p: any) => ({ ...p, status: p.status === "new" ? "pending" : p.status, service_type: "program", slot_time: null }));
  const consultationBookings = (consultation || []).map((c: any) => ({
    ...c,
    client_name: c.name,
    client_phone: c.phone,
    notes: c.message,
    status: c.status === "new" ? "pending" : c.status,
    service_type: c.service_type || "consultation",
    slot_time: null,
  }));

  const bookings = [
    ...mapBookings(bfm, "bfm"), ...mapBookings(brt, "brt"), ...mapBookings(psy, "psychology"),
    ...programBookings, ...consultationBookings,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 16_384); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const service = cleanText(body.service_type, 20);
  let slotId = cleanText(body.slot_id, 64);
  const slotTime = cleanText(body.slot_time, 64);
  const name = cleanText(body.client_name, 120);
  const phone = normalizePhone(body.client_phone);
  if (!(["bfm", "brt", "psychology"] as string[]).includes(service) || (!slotId && !slotTime) || !name || !phone) {
    return NextResponse.json({ error: "Проверьте данные записи" }, { status: 400 });
  }
  if (body.consent_confirmed !== true) {
    return NextResponse.json({ error: "Подтвердите согласие клиента на обработку данных" }, { status: 400 });
  }

  if (!slotId) {
    const parsed = new Date(slotTime);
    if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return NextResponse.json({ error: "Выберите будущее время" }, { status: 400 });
    const created = await pool.query<{ id: string }>(
      `INSERT INTO slots (service_type, slot_time, duration_minutes)
       VALUES ($1,$2,$3)
       ON CONFLICT (slot_time, service_type) DO UPDATE SET duration_minutes=EXCLUDED.duration_minutes
       RETURNING id::text`,
      [service, parsed.toISOString(), SERVICE_DURATION_MINUTES[service as ServiceType]],
    );
    slotId = created.rows[0]?.id || "";
  }
  const claimed = await claimSlot(slotId, service as ServiceType, {
    slot_id: slotId,
    client_name: name,
    client_phone: phone,
    client_email: null,
    client_tg: null,
    ...(service === "psychology" ? { booking_type: "offline" } : {}),
    status: "confirmed",
    payment_option: "at_appointment",
    payment_status: "due",
    consent_version: CONSENT_VERSION,
    consent_at: new Date().toISOString(),
  });
  if (!claimed.ok) return NextResponse.json({ error: claimed.error }, { status: claimed.status });
  return NextResponse.json({ booking: claimed.booking }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8192); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const { id, status, slot_id, service_type } = body;
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  if (slot_id) {
    if (!["bfm", "brt", "psychology"].includes(String(service_type))) return NextResponse.json({ error: "Некорректная услуга" }, { status: 400 });
    const result = await rescheduleBooking({ bookingId: String(id), serviceType: service_type as ServiceType, newSlotId: String(slot_id) });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, slot: result.slot });
  }
  try {
    const booking = await updateAdminBooking(String(id), String(body.action || status), {
      email: cleanText(body.account_email, 254), reason: cleanText(body.link_reason, 500), confirmed: body.identity_confirmed === true,
    });
    return NextResponse.json({ ok: true, booking });
  } catch (error) {
    if (error instanceof BookingActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin booking] Failed');
    return NextResponse.json({ error: 'Не удалось обновить запись' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  for (const table of ["program_enrollments", "consultation_enrollments", "bfm_bookings", "brt_bookings", "psychology_bookings"]) {
    const { data: booking } = await db.from(table).select("status").eq("id", id).single();
    if (booking) {
      if (booking.status !== "completed" && booking.status !== "cancelled") {
        return NextResponse.json({ error: "Можно удалять только завершённые или отменённые заявки" }, { status: 400 });
      }
      await db.from(table).delete().eq("id", id);
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
}
