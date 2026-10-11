import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireCronSecret } from "@/lib/cron-auth";
import { refreshScheduleOccupancy } from "@/lib/slots";

/**
 * Keeps a rolling booking horizon when called once a week. Every Sunday the
 * next seven farthest days (+30 through +36) copy the service/time pattern
 * from the same weekdays four weeks earlier.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await pool.query<{ target_date: string }>(`
      WITH dates AS (
        SELECT ((now() AT TIME ZONE 'Europe/Moscow')::date + offset_days) AS target_date
          FROM generate_series(30, 36) AS series(offset_days)
      ), source_slots AS (
        SELECT s.service_type, s.duration_minutes,
               (dates.target_date + (s.slot_time AT TIME ZONE 'Europe/Moscow')::time) AT TIME ZONE 'Europe/Moscow' AS target_time
          FROM slots s CROSS JOIN dates
         WHERE (s.slot_time AT TIME ZONE 'Europe/Moscow')::date = dates.target_date - 28
      ), inserted AS (
        INSERT INTO slots (service_type, slot_time, duration_minutes)
        SELECT service_type, target_time, duration_minutes FROM source_slots
        ON CONFLICT (slot_time, service_type) DO NOTHING
        RETURNING (slot_time AT TIME ZONE 'Europe/Moscow')::date::text AS target_date
      )
      SELECT target_date FROM inserted`);

    await refreshScheduleOccupancy();

    const dates = [...new Set(result.rows.map((row) => row.target_date))];
    return NextResponse.json({
      ok: true,
      count: result.rowCount,
      days_added: dates.length,
      dates,
    });
  } catch (error) {
    console.error("[Cron extend-schedule] Failed", error);
    return NextResponse.json({ error: "Не удалось продлить расписание" }, { status: 500 });
  }
}
