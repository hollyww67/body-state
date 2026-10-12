import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createScheduleBreak, deleteScheduleBreak } from "@/lib/slots";
import { pool } from "@/lib/db";
import { dateRange,dayAfter,moscowInstant,ScheduleError,validDay } from '@/lib/schedule-plan';
import { moscowDayKey } from '@/lib/moscow-time';
import {readJsonObject} from '@/lib/request';

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const from=validDay(request.nextUrl.searchParams.get('from')??moscowDayKey(new Date()));
    const to=validDay(request.nextUrl.searchParams.get('to')??dayAfter(from,30));
    if(dateRange(from,to).length>93) throw new ScheduleError('Выберите не более 93 дней');
    const result=await pool.query('SELECT * FROM schedule_breaks WHERE ends_at>$1 AND starts_at<$2 ORDER BY starts_at,id',[moscowInstant(from,0),moscowInstant(dayAfter(to),0)]);
    return NextResponse.json({breaks:result.rows});
  } catch(error) {return NextResponse.json({error:error instanceof ScheduleError?error.message:'Не удалось загрузить перерывы'},{status:error instanceof ScheduleError?error.status:500});}
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  let body:Record<string,unknown>;
  try{body=await readJsonObject(request,8192);}catch{return NextResponse.json({error:'Некорректный JSON'},{status:400});}
  const startsAt = new Date(String(body.starts_at || ""));
  const endsAt = new Date(String(body.ends_at || ""));
  const reason = String(body.reason || "Перерыв").trim().slice(0, 200) || "Перерыв";
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return NextResponse.json({ error: "Проверьте начало и окончание перерыва" }, { status: 400 });
  if (startsAt <= new Date()) return NextResponse.json({ error: "Перерыв должен начинаться в будущем" }, { status: 400 });
  if (endsAt.getTime() - startsAt.getTime() > 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Один перерыв не может быть длиннее 7 дней" }, { status: 400 });
  const result = await createScheduleBreak({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ break: result.scheduleBreak }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const id = new URL(request.url).searchParams.get("id");
  if (!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Некорректный ID перерыва" }, { status: 400 });
  const result = await deleteScheduleBreak(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
