import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT slot.id::text, slot.service_type, slot.slot_time, slot.duration_minutes, slot.is_booked,
             EXISTS (
               SELECT 1 FROM schedule_breaks pause
                WHERE tstzrange(slot.slot_time, slot.slot_time + slot.duration_minutes * interval '1 minute', '[)')
                   && tstzrange(pause.starts_at, pause.ends_at, '[)')
             ) AS is_break
        FROM slots slot
       ORDER BY slot.slot_time ASC`);
    return NextResponse.json({ slots: result.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить расписание" }, { status: 500 });
  }
}
