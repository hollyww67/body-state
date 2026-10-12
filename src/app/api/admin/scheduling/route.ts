import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import {readJsonObject} from '@/lib/request';
import { applySchedule, applyTemplate, changeWindows,clearScheduleExceptions,copyDayPlan, extendSchedule, normalizeWeek, previewSchedule, previewTemplate, saveScheduleTemplate, setScheduleExceptions, withScheduleTransaction } from '@/lib/schedule-management';
import { dateRange,normalizeHours, normalizePlan, ScheduleError, validDay } from '@/lib/schedule-plan';
import {addDays} from 'date-fns';
import {moscowDate,formatMoscow,moscowInputToISO} from '@/lib/moscow-time';

function failure(error:unknown) {
  if(error instanceof ScheduleError) return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof SyntaxError) return NextResponse.json({error:'Некорректный JSON'},{status:400});
  console.error('[Scheduling] Operation failed');
  return NextResponse.json({error:'Не удалось выполнить операцию расписания'},{status:500});
}

export async function GET(request:NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  try {
    const data=await db.transaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const templates=await client.query('SELECT * FROM schedule_templates ORDER BY active DESC,name,id');
      const exceptions=await client.query("SELECT day::text,mode,hours,reason,version FROM schedule_exceptions WHERE day>=(now() AT TIME ZONE 'Europe/Moscow')::date ORDER BY day LIMIT 366");
      const runs=await client.query('SELECT * FROM schedule_runs ORDER BY id DESC LIMIT 10');
      const clock=(await client.query('SELECT now() AS now, (SELECT max(slot_time) FROM slots WHERE slot_time>now() AND NOT is_booked) AS published_through')).rows[0];
      const now=moscowDate(clock.now),sunday=addDays(now,(7-now.getDay())%7);
      let next=moscowInputToISO(formatMoscow(sunday,'yyyy-MM-dd'),'03:15');
      if(Date.parse(next)<=now.getTime())next=moscowInputToISO(formatMoscow(addDays(sunday,7),'yyyy-MM-dd'),'03:15');
      return {templates:templates.rows,exceptions:exceptions.rows,runs:runs.rows,generation:{next_run_at:next,published_through:clock.published_through}};
    });
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return failure(error);}
}

export async function POST(request:NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  try {
    let body:Record<string,unknown>;
    try {body=await readJsonObject(request,1_048_576);} catch {throw new ScheduleError('Некорректный JSON или слишком большой запрос');}
    if(!body||typeof body!=='object'||Array.isArray(body)) throw new ScheduleError('Некорректная операция');
    switch(body.action) {
      case 'preview': return NextResponse.json(await withScheduleTransaction(client=>previewSchedule(client,normalizePlan(body))));
      case 'apply': return NextResponse.json(await applySchedule(normalizePlan(body),String(body.token??''),String(body.request_key??'')));
      case 'template': return NextResponse.json({template:await saveScheduleTemplate({id:typeof body.id==='string'?body.id:undefined,version:typeof body.version==='number'?body.version:undefined,name:String(body.name??''),week:normalizeWeek(body.week),horizon:Number(body.horizon_days),active:body.active===true})});
      case 'extend-preview': return NextResponse.json(await extendSchedule(true));
      case 'close-windows':
      case 'open-windows': {
        if(!Array.isArray(body.ids)||body.ids.some((id:unknown)=>typeof id!=='string')) throw new ScheduleError('Укажите окна');
        return NextResponse.json(await changeWindows(body.ids,body.action==='close-windows'));
      }
      case 'copy-preview': {
        if(!Array.isArray(body.dates)||!body.dates.length||body.dates.length>366)throw new ScheduleError('Выберите даты');
        const dates=[...new Set<string>(body.dates.map(validDay))].sort();
        return NextResponse.json(await withScheduleTransaction(async client=>{
          const plan=await copyDayPlan(client,validDay(body.source_day),dates);
          return {...await previewSchedule(client,plan),plan};
        }));
      }
      case 'template-preview':
      case 'template-apply': {
        const dates=dateRange(validDay(body.from),validDay(body.to));
        const id=String(body.template_id??'');
        return NextResponse.json(body.action==='template-preview'?
          await withScheduleTransaction(client=>previewTemplate(client,id,dates)):
          await applyTemplate(id,dates,String(body.token??''),String(body.request_key??'')));
      }
      case 'exception':
      case 'clear-exception': {
        if(!Array.isArray(body.dates)||!body.dates.length||body.dates.length>366) throw new ScheduleError('Выберите от 1 до 366 дат');
        const dates=[...new Set<string>(body.dates.map(validDay))].sort();
        const result=body.action==='clear-exception'?await clearScheduleExceptions(dates):
          await setScheduleExceptions(dates,body.mode==='closed'?null:normalizeHours(body.hours),String(body.reason??'').trim().slice(0,500));
        return NextResponse.json(result);
      }
      default: throw new ScheduleError('Неизвестная операция');
    }
  } catch(error) {return failure(error);}
}
