import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from '@/lib/admin-auth';
import {readJsonObject} from '@/lib/request';
import { refreshSlotOccupancy, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";

export async function POST(request: NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  let slots:unknown;
  try {({slots}=await readJsonObject(request,1_048_576));} catch {return NextResponse.json({error:'Некорректный JSON или слишком большой запрос'},{status:400});}

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Нет слотов для добавления" }, { status: 400 });
  }

  if (slots.length > 5000) return NextResponse.json({ error: "За один раз можно создать не более 5000 слотов" }, { status: 400 });

  const normalized = slots.map((slot) => {
    const service = String(slot?.service_type || "") as ServiceType;
    const time = new Date(String(slot?.slot_time || ""));
    if (!['bfm','brt','psychology'].includes(service) || Number.isNaN(time.getTime()) || time<=new Date()) return null;
    return { service, time: time.toISOString(), duration: SERVICE_DURATION_MINUTES[service] };
  });
  if (normalized.some((slot) => !slot)) return NextResponse.json({ error: "В списке есть некорректные слоты" }, { status: 400 });

  const values: unknown[] = [];
  const groups = normalized.map((slot) => {
    values.push(slot!.service, slot!.time, slot!.duration);
    return `($${values.length - 2}, $${values.length - 1}, $${values.length})`;
  });
  try {
    const result = await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const inserted=await client.query(
      `INSERT INTO slots (service_type, slot_time, duration_minutes)
       VALUES ${groups.join(",")}
       ON CONFLICT (slot_time, service_type) DO NOTHING
       RETURNING id::text, service_type, slot_time, duration_minutes, is_booked`,
      values,
    );
      await refreshSlotOccupancy(client);
      const refreshed=inserted.rows.length?await client.query('SELECT id::text,service_type,slot_time,duration_minutes,is_booked FROM slots WHERE id=ANY($1::uuid[])',[inserted.rows.map(r=>r.id)]):inserted;
      return {rowCount:inserted.rowCount,rows:refreshed.rows};
    });
    return NextResponse.json({ ok: true, count: result.rowCount, slots: result.rows }, { status: 201 });
  } catch {
    console.error('[Scheduling] Batch creation failed');
    return NextResponse.json({ error: "Не удалось создать слоты" }, { status: 500 });
  }
}
