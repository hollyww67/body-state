import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { refreshScheduleOccupancy, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";

export async function POST(request: NextRequest) {
  const { slots } = await request.json();

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Нет слотов для добавления" }, { status: 400 });
  }

  if (slots.length > 5000) return NextResponse.json({ error: "За один раз можно создать не более 5000 слотов" }, { status: 400 });

  const normalized = slots.map((slot) => {
    const service = String(slot?.service_type || "") as ServiceType;
    const time = new Date(String(slot?.slot_time || ""));
    if (!(service in SERVICE_DURATION_MINUTES) || Number.isNaN(time.getTime())) return null;
    return { service, time: time.toISOString(), duration: SERVICE_DURATION_MINUTES[service] };
  });
  if (normalized.some((slot) => !slot)) return NextResponse.json({ error: "В списке есть некорректные слоты" }, { status: 400 });

  const values: unknown[] = [];
  const groups = normalized.map((slot) => {
    values.push(slot!.service, slot!.time, slot!.duration);
    return `($${values.length - 2}, $${values.length - 1}, $${values.length})`;
  });
  try {
    const result = await pool.query(
      `INSERT INTO slots (service_type, slot_time, duration_minutes)
       VALUES ${groups.join(",")}
       ON CONFLICT (slot_time, service_type) DO UPDATE SET duration_minutes=EXCLUDED.duration_minutes
       RETURNING id::text, service_type, slot_time, duration_minutes, is_booked`,
      values,
    );
    await refreshScheduleOccupancy();
    return NextResponse.json({ ok: true, count: result.rowCount, slots: result.rows }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать слоты" }, { status: 500 });
  }
}
