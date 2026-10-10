import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get("service_type");

  if (!serviceType || !["bfm", "brt", "psychology"].includes(serviceType)) {
    return NextResponse.json({ error: "Укажите корректный тип услуги" }, { status: 400 });
  }

  try {
    const result = await pool.query(`
      WITH active AS (
        SELECT s.slot_time, s.duration_minutes FROM bfm_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status NOT IN ('cancelled','completed')
        UNION ALL SELECT s.slot_time, s.duration_minutes FROM brt_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status NOT IN ('cancelled','completed')
        UNION ALL SELECT s.slot_time, s.duration_minutes FROM psychology_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status NOT IN ('cancelled','completed')
      )
      SELECT candidate.id::text, candidate.service_type, candidate.slot_time, candidate.duration_minutes
        FROM slots candidate
       WHERE candidate.service_type=$1 AND candidate.slot_time > now() AND candidate.is_booked=false
         AND NOT EXISTS (
           SELECT 1 FROM active appointment
            WHERE tstzrange(candidate.slot_time, candidate.slot_time + candidate.duration_minutes * interval '1 minute', '[)')
               && tstzrange(appointment.slot_time, appointment.slot_time + appointment.duration_minutes * interval '1 minute', '[)')
         )
         AND NOT EXISTS (
           SELECT 1 FROM schedule_breaks pause
            WHERE tstzrange(candidate.slot_time, candidate.slot_time + candidate.duration_minutes * interval '1 minute', '[)')
               && tstzrange(pause.starts_at, pause.ends_at, '[)')
         )
       ORDER BY candidate.slot_time ASC`, [serviceType]);
    return NextResponse.json({ slots: result.rows, duration_minutes: SERVICE_DURATION_MINUTES[serviceType as ServiceType] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка расписания" }, { status: 500 });
  }
}
