import { NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from '@/lib/admin-auth';
import { dateRange,dayAfter,moscowInstant,ScheduleError,validDay } from '@/lib/schedule-plan';
import { moscowDayKey } from '@/lib/moscow-time';

export async function GET(request:NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  try {
    const q=request.nextUrl.searchParams;
    const from=validDay(q.get('from')??moscowDayKey(new Date())),to=validDay(q.get('to')??dayAfter(from,30));
    if(dateRange(from,to).length>93) throw new ScheduleError('Загрузите не более 93 дней за раз');
    const service=q.get('service'),availability=q.get('availability');
    if(service&&!['bfm','brt','psychology'].includes(service)) throw new ScheduleError('Некорректное направление');
    if(availability&&!['free','booked'].includes(availability)) throw new ScheduleError('Некорректный фильтр');
    const offset=Number(q.get('offset')??0),limit=Number(q.get('limit')??500);
    if(!Number.isInteger(offset)||offset<0||offset>100_000||!Number.isInteger(limit)||limit<1||limit>1000) throw new ScheduleError('Некорректная страница');
    const data=await db.transaction(async client=>{
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const values=[moscowInstant(from,0),moscowInstant(dayAfter(to),0),service,availability==='free'?false:availability==='booked'?true:null];
    const where='slot.slot_time >= $1 AND slot.slot_time < $2 AND ($3::text IS NULL OR slot.service_type=$3) AND ($4::boolean IS NULL OR slot.is_booked=$4)';
    const counters=await client.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT slot.is_booked)::int AS free,
      count(*) FILTER(WHERE slot.is_booked)::int AS booked FROM slots slot WHERE ${where}`,values);
    const result = await client.query(`
      SELECT slot.id::text, slot.service_type, slot.slot_time, slot.duration_minutes, slot.is_booked,
             EXISTS(SELECT 1 FROM schedule_days d WHERE d.day=(slot.slot_time AT TIME ZONE 'Europe/Moscow')::date
               AND (d.mode<>'published' OR (d.hours->'services' IS NOT NULL AND NOT(d.hours->'services' ? slot.service_type)))) AS is_closed,
             EXISTS (
               SELECT 1 FROM schedule_breaks pause
                WHERE tstzrange(slot.slot_time, slot.slot_time + slot.duration_minutes * interval '1 minute', '[)')
                   && tstzrange(pause.starts_at, pause.ends_at, '[)')
             ) AS is_break
        FROM slots slot
       WHERE ${where}
       ORDER BY slot.slot_time,slot.service_type,slot.id LIMIT $5 OFFSET $6`,[...values,limit,offset]);
    return {slots:result.rows,counts:counters.rows[0],from,to,offset,limit,next_offset:offset+result.rows.length<counters.rows[0].total?offset+result.rows.length:null};
    });
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return NextResponse.json({ error: error instanceof ScheduleError ? error.message : "Не удалось загрузить расписание" }, { status: error instanceof ScheduleError?error.status:500 });
  }
}
