import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { refreshSlotOccupancy } from '@/lib/slots';
import { clock,dateRange, dayAfter, generateStarts, minutes, moscowInstant, normalizeHours, ScheduleError, validDay,type Hours, type SchedulePlan, type WeekDay } from '@/lib/schedule-plan';
import { formatMoscow,moscowDayKey } from '@/lib/moscow-time';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const appointmentsSql = ['bfm','brt','psychology'].map(service => `SELECT b.id, '${service}' AS service_type, b.status,
  s.id AS slot_id, s.slot_time AS starts_at, s.slot_time+s.duration_minutes*interval '1 minute' AS ends_at
  FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status NOT IN ('cancelled','completed')`).join(' UNION ALL ');
type Interval = { starts_at: string | Date; ends_at: string | Date };
const overlaps = (a: Interval, b: Interval) => new Date(a.starts_at).getTime() < new Date(b.ends_at).getTime() && new Date(a.ends_at).getTime() > new Date(b.starts_at).getTime();
const iso = (value: string | Date) => new Date(value).toISOString();

export async function withScheduleTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  return db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [913202609]);
    await client.query("SELECT set_config('body_state.actor','admin',true)");
    return fn(client);
  });
}

/** One client and one consistent snapshot. No contacts are needed for preview freshness. */
async function context(client: PoolClient, dates: string[]) {
  const from = moscowInstant(dates[0],0), to = moscowInstant(dayAfter(dates.at(-1)!),0);
  const slots = await client.query(`SELECT s.id,s.service_type,s.slot_time,s.duration_minutes,
    EXISTS(SELECT 1 FROM bfm_bookings WHERE slot_id=s.id UNION ALL SELECT 1 FROM brt_bookings WHERE slot_id=s.id
      UNION ALL SELECT 1 FROM psychology_bookings WHERE slot_id=s.id
      UNION ALL SELECT 1 FROM booking_events WHERE old_slot_id=s.id OR new_slot_id=s.id) AS protected
    FROM slots s WHERE s.slot_time >= $1 AND s.slot_time < $2 ORDER BY s.slot_time,s.service_type,s.id`,[from,to]);
  const appointments = await client.query(`SELECT * FROM (${appointmentsSql}) a WHERE ends_at>$1 AND starts_at<$2 ORDER BY starts_at,id`,[from,to]);
  const breaks = await client.query('SELECT id,starts_at,ends_at,reason,source_type,source_key FROM schedule_breaks WHERE ends_at>$1 AND starts_at<$2 ORDER BY starts_at,id',[from,to]);
  const exceptions = await client.query('SELECT day::text,mode,hours,version FROM schedule_exceptions WHERE day=ANY($1::date[]) ORDER BY day',[dates]);
  const days = await client.query('SELECT day::text,mode,hours,template_id FROM schedule_days WHERE day=ANY($1::date[]) ORDER BY day',[dates]);
  return {slots:slots.rows, appointments:appointments.rows, breaks:breaks.rows, exceptions:exceptions.rows, days:days.rows};
}

export async function previewSchedule(client: PoolClient, plan: SchedulePlan) {
  const state = await context(client,plan.dates);
  const now = Date.now();
  const exact = new Map(state.slots.map(s=>[`${s.service_type}:${iso(s.slot_time)}`,s]));
  const plannedBreaks=plan.dates.flatMap(day=>plan.hours.breaks.map(b=>({starts_at:moscowInstant(day,minutes(b.start)),ends_at:moscowInstant(day,minutes(b.end))}))).filter(b=>Date.parse(b.ends_at)>now);
  const breakConflicts=state.appointments.filter(a=>plannedBreaks.some(b=>overlaps(a,b))).length;
  const counts = { created:0, existing:0, unchanged:0, blocked:0, protected:0, conflicts:0, closed:0, opened:0, past:0 };
  const rows = generateStarts({...plan,hours:{...plan.hours,breaks:[]}}).map(start=>{
    const interval={starts_at:start.time, ends_at:new Date(Date.parse(start.time)+start.duration*60000)};
    const existing = exact.get(`${start.service}:${start.time}`);
    const exception=state.exceptions.find(e=>e.day===start.day);
    const rule=state.days.find(d=>d.day===start.day);
    let result: keyof typeof counts;
    if (Date.parse(start.time)<=now) result='past';
    else if (existing?.protected) result='protected';
    else if (exception?.mode==='closed' || rule?.mode==='closed' || state.breaks.some(b=>overlaps(interval,b))||plannedBreaks.some(b=>overlaps(interval,b))) result='blocked';
    else if (state.appointments.some(a=>overlaps(interval,a))) result='conflicts';
    else if (existing) result='existing';
    else result='created';
    counts[result]++;
    return {...start,id:existing?.id??null,result};
  });
  counts.unchanged=counts.existing+counts.protected+counts.blocked+counts.conflicts+counts.past;
  counts.conflicts+=breakConflicts;
  // Crossing into the past changes eligibility and therefore must invalidate preview.
  const token=hash({plan,state,eligible:rows.map(r=>r.result)});
  return {token,counts,rows,breakConflicts,plannedBreaks};
}

async function insertStarts(client: PoolClient, starts: {service:string;time:string;duration:number}[]) {
  if (!starts.length) return 0;
  const result = await client.query(`INSERT INTO slots(service_type,slot_time,duration_minutes)
    SELECT service,time,duration FROM jsonb_to_recordset($1::jsonb) AS x(service text,time timestamptz,duration integer)
    ON CONFLICT(service_type,slot_time) DO NOTHING RETURNING id`,[JSON.stringify(starts)]);
  return result.rowCount??0;
}

export async function applySchedule(plan: SchedulePlan, token: string, requestKey: string) {
  if(!UUID.test(requestKey)) throw new ScheduleError('Некорректный ключ операции');
  return withScheduleTransaction(async client=>{
    const inputHash=hash(plan);
    const previous=await client.query('SELECT input_hash,result FROM schedule_operations WHERE request_key=$1',[requestKey]);
    if(previous.rows[0]) {
      if(previous.rows[0].input_hash!==inputHash) throw new ScheduleError('Ключ уже использован для другого расписания',409);
      return previous.rows[0].result;
    }
    const preview=await previewSchedule(client,plan);
    if(preview.token!==token) throw new ScheduleError('Расписание изменилось. Повторите предпросмотр.',409);
    if(preview.breakConflicts)throw new ScheduleError('Перерывы генератора пересекаются с действующими записями. Изменения не применены.',409);
    let breaksCreated=0;
    for(const pause of preview.plannedBreaks) {
      const inserted=await client.query(`INSERT INTO schedule_breaks(starts_at,ends_at,reason,source_type,source_key)
        SELECT $1,$2,$3,'manual',$4 WHERE NOT EXISTS(SELECT 1 FROM schedule_breaks WHERE starts_at=$1 AND ends_at=$2)`,[pause.starts_at,pause.ends_at,plan.reason||'Перерыв рабочего графика',requestKey]);
      breaksCreated+=inserted.rowCount??0;
    }
    const created=await insertStarts(client,preview.rows.filter(r=>r.result==='created'));
    for(const day of plan.dates) {
      // Generating starts is additive, not an implicit replacement of work hours or exceptions.
      await client.query(`INSERT INTO schedule_days(day,mode) VALUES($1,'published') ON CONFLICT(day) DO NOTHING`,[day]);
    }
    await refreshSlotOccupancy(client);
    const result={...preview.counts,created,breaks_created:breaksCreated,dates:plan.dates};
    await client.query('INSERT INTO schedule_operations(request_key,input_hash,result) VALUES($1,$2,$3)',[requestKey,inputHash,result]);
    return result;
  });
}

function blockedIntervals(day: string, hours: Hours | null) {
  if(!hours) return [{starts_at:moscowInstant(day,0),ends_at:moscowInstant(day,1440)}];
  return [{start:0,end:minutes(hours.start)},{start:minutes(hours.end),end:1440},
    ...hours.breaks.map(b=>({start:minutes(b.start),end:minutes(b.end)}))]
    .filter(r=>r.start<r.end).map(r=>({starts_at:moscowInstant(day,r.start),ends_at:moscowInstant(day,r.end)}));
}

/** Owned blocks allow clearing an exception without ever deleting a manual break. */
async function setDayRule(client: PoolClient, day: string, hours: Hours|null, reason: string, source: 'exception'|'template', templateId?: string) {
  const intervals=blockedIntervals(day,hours);
  const active=await client.query(`SELECT * FROM (${appointmentsSql}) a WHERE ends_at>$1 AND starts_at<$2`,[moscowInstant(day,0),moscowInstant(day,1440)]);
  if(active.rows.some(a=>intervals.some(b=>overlaps(a,b)))) throw new ScheduleError(`На ${day} есть запись в закрываемом интервале. Перенесите или отмените её отдельно.`,409);
  await client.query('DELETE FROM schedule_breaks WHERE source_type=$1 AND source_key=$2',[source,day]);
  for(const interval of intervals) await client.query(`INSERT INTO schedule_breaks(starts_at,ends_at,reason,source_type,source_key) VALUES($1,$2,$3,$4,$5)`,[interval.starts_at,interval.ends_at,reason,source,day]);
  await client.query(`INSERT INTO schedule_days(day,mode,hours,template_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(day) DO UPDATE SET mode=EXCLUDED.mode,hours=EXCLUDED.hours,template_id=EXCLUDED.template_id,updated_at=now()`,[day,hours?'published':'closed',hours,templateId??null]);
}

export async function setScheduleExceptions(dates:string[], hours:Hours|null, reason:string) {
  return withScheduleTransaction(async client=>{
    for(const day of dates) {
      // An explicit exception replaces template-owned blocks, never manual breaks.
      await client.query("DELETE FROM schedule_breaks WHERE source_type='template' AND source_key=$1",[day]);
      await setDayRule(client,day,hours,reason,'exception');
      await client.query(`INSERT INTO schedule_exceptions(day,mode,hours,reason) VALUES($1,$2,$3,$4)
        ON CONFLICT(day) DO UPDATE SET mode=EXCLUDED.mode,hours=EXCLUDED.hours,reason=EXCLUDED.reason,version=schedule_exceptions.version+1,updated_at=now()`,[day,hours?'hours':'closed',hours,reason]);
      if(hours) {
        const preview=await previewSchedule(client,{dates:[day],hours,reason});
        await insertStarts(client,preview.rows.filter(r=>r.result==='created'));
      }
    }
    await refreshSlotOccupancy(client);
    return {changed:dates.length};
  });
}

export async function clearScheduleExceptions(dates:string[]) {
  return withScheduleTransaction(async client=>{
    const active=(await client.query('SELECT id,week FROM schedule_templates WHERE active')).rows[0];
    for(const day of dates) {
      await client.query("DELETE FROM schedule_breaks WHERE source_type='exception' AND source_key=$1",[day]);
      await client.query('DELETE FROM schedule_exceptions WHERE day=$1',[day]);
      if(active) {
        const hours:Hours|null=active.week[new Date(`${day}T12:00Z`).getUTCDay()];
        await setDayRule(client,day,hours, 'Рабочий шаблон','template',active.id);
        if(hours){const preview=await previewSchedule(client,{dates:[day],hours,reason:''});await insertStarts(client,preview.rows.filter(r=>r.result==='created'));}
      }
      else await client.query("UPDATE schedule_days SET mode='published',hours=NULL,template_id=NULL,updated_at=now() WHERE day=$1",[day]);
    }
    await refreshSlotOccupancy(client);
    return {changed:dates.length};
  });
}

export function normalizeWeek(value: unknown): WeekDay[] {
  if(!Array.isArray(value)||value.length!==7) throw new ScheduleError('Укажите семь дней недели, начиная с воскресенья');
  return value.map(day=>day===null?null:normalizeHours(day));
}

export async function saveScheduleTemplate(input:{id?:string;version?:number;name:string;week:WeekDay[];horizon:number;active:boolean}) {
  if(!input.name.trim()||input.name.length>120||!Number.isInteger(input.horizon)||input.horizon<7||input.horizon>180||(input.id&&!UUID.test(input.id))) throw new ScheduleError('Проверьте имя и горизонт шаблона');
  return withScheduleTransaction(async client=>{
    if(input.active) await client.query('UPDATE schedule_templates SET active=false WHERE active');
    const result=input.id ? await client.query(`UPDATE schedule_templates SET name=$2,week=$3,horizon_days=$4,active=$5,version=version+1,updated_at=now()
      WHERE id=$1 AND version=$6 RETURNING *`,[input.id,input.name.trim(),JSON.stringify(input.week),input.horizon,input.active,input.version]) :
      await client.query('INSERT INTO schedule_templates(name,week,horizon_days,active) VALUES($1,$2,$3,$4) RETURNING *',[input.name.trim(),JSON.stringify(input.week),input.horizon,input.active]);
    if(!result.rows[0]) throw new ScheduleError('Шаблон изменён другим запросом. Обновите страницу.',409);
    return result.rows[0];
  });
}

export async function extendSchedule(dryRun=false) {
  return withScheduleTransaction(async client=>{
    const template=(await client.query('SELECT * FROM schedule_templates WHERE active')).rows[0];
    if(!template) {
      // Same legacy horizon/pattern, but exceptions and blocks cannot be reopened.
      const source=await client.query(`WITH dates AS (
          SELECT ((now() AT TIME ZONE 'Europe/Moscow')::date + n) AS day FROM generate_series(30,36) n
        ) SELECT s.service_type AS service,s.duration_minutes AS duration,
          ((d.day+(s.slot_time AT TIME ZONE 'Europe/Moscow')::time) AT TIME ZONE 'Europe/Moscow') AS time
        FROM slots s CROSS JOIN dates d
        WHERE (s.slot_time AT TIME ZONE 'Europe/Moscow')::date=d.day-28
          AND NOT EXISTS(SELECT 1 FROM schedule_exceptions e WHERE e.day=d.day)
          AND NOT EXISTS(SELECT 1 FROM schedule_days p WHERE p.day=d.day AND p.mode IN ('closed','unpublished'))
        ORDER BY d.day,s.service_type,s.slot_time`);
      const starts=source.rows.map(s=>({...s,time:iso(s.time)}));
      const days=[...new Set(starts.map(s=>moscowDayKey(s.time)))];
      const eligible:typeof starts=[];
      if(days.length) {
        const state=await context(client,days);
        for(const s of starts) {
          const interval={starts_at:s.time,ends_at:new Date(Date.parse(s.time)+s.duration*60000)};
          if(!state.breaks.some(b=>overlaps(interval,b))&&!state.appointments.some(a=>overlaps(interval,a))&&
             !state.slots.some(a=>a.service_type===s.service&&iso(a.slot_time)===s.time)) eligible.push(s);
        }
      }
      const count=dryRun?eligible.length:await insertStarts(client,eligible);
      if(!dryRun) await refreshSlotOccupancy(client);
      const addedDays=[...new Set(eligible.map(s=>moscowDayKey(s.time)))];
      const result={ok:true,mode:'legacy',dry_run:dryRun,count,days_added:addedDays.length,dates:addedDays};
      if(!dryRun) await client.query('INSERT INTO schedule_runs(result) VALUES($1)',[result]);
      return result;
    }
    const today=moscowDayKey(new Date());
    const dates=dateRange(dayAfter(today),dayAfter(today,template.horizon_days));
    const state=await context(client,dates);
    const blockedConflicts:string[]=[];
    const starts:{service:string;time:string;duration:number}[]=[];
    let closed=0;
    for(const day of dates) {
      const exception=state.exceptions.find(e=>e.day===day);
      const hours:Hours|null=exception?(exception.mode==='closed'?null:normalizeHours(exception.hours)):
        template.week[new Date(`${day}T12:00Z`).getUTCDay()];
      const intervals=blockedIntervals(day,hours);
      if(state.appointments.some(a=>intervals.some(b=>overlaps(a,b)))) blockedConflicts.push(day);
      if(!hours) {closed++;continue;}
      for(const s of generateStarts({dates:[day],hours,reason:''})) {
        const interval={starts_at:s.time,ends_at:new Date(Date.parse(s.time)+s.duration*60000)};
        // Old template-owned blocks are replaced; manual and exception blocks retain precedence.
        if(!state.slots.some(a=>a.service_type===s.service&&iso(a.slot_time)===s.time)&&
          !state.appointments.some(a=>overlaps(a,interval))&&
          !state.breaks.some(b=>b.source_type!=='template'&&overlaps(b,interval))) starts.push(s);
      }
    }
    if(starts.length>5000) throw new ScheduleError('Горизонт превышает 5000 новых окон. Сократите горизонт или направления.');
    if(blockedConflicts.length&&!dryRun) throw new ScheduleError(`Шаблон конфликтует с записями: ${blockedConflicts.join(', ')}`,409);
    if(!dryRun) for(const day of dates) {
      if(state.exceptions.some(e=>e.day===day)) continue;
      await setDayRule(client,day,template.week[new Date(`${day}T12:00Z`).getUTCDay()],template.name,'template',template.id);
    }
    const count=dryRun?starts.length:await insertStarts(client,starts);
    if(!dryRun) await refreshSlotOccupancy(client);
    const result={ok:!blockedConflicts.length,mode:'template',dry_run:dryRun,count,closed,conflicts:blockedConflicts,dates,horizon_end:dates.at(-1),template_id:template.id,template_version:template.version};
    if(!dryRun) await client.query('INSERT INTO schedule_runs(template_id,template_version,result) VALUES($1,$2,$3)',[template.id,template.version,result]);
    return result;
  });
}

/** Explicit template period uses the same rule writer as the existing weekly cron. */
export async function previewTemplate(client:PoolClient,templateId:string,dates:string[]) {
  if(!UUID.test(templateId)) throw new ScheduleError('Некорректный шаблон');
  const template=(await client.query('SELECT * FROM schedule_templates WHERE id=$1',[templateId])).rows[0];
  if(!template) throw new ScheduleError('Шаблон не найден',404);
  const state=await context(client,dates);
  const counts={created:0,existing:0,unchanged:0,blocked:0,protected:0,conflicts:0,closed:0,opened:0,past:0};
  const days=dates.map(day=>{
    const exception=state.exceptions.find(e=>e.day===day);
    const hours:Hours|null=exception?(exception.mode==='closed'?null:normalizeHours(exception.hours)):template.week[new Date(`${day}T12:00Z`).getUTCDay()];
    const blocks=blockedIntervals(day,hours);
    const conflicts=state.appointments.filter(a=>blocks.some(b=>overlaps(a,b))).length;
    const previous=state.days.find(d=>d.day===day);
    if(conflicts) counts.conflicts+=conflicts;
    if(!hours&&previous?.mode!=='closed') counts.closed++;
    if(hours&&previous?.mode!=='published') counts.opened++;
    const starts=hours?generateStarts({dates:[day],hours,reason:''}).map(s=>{
      const existing=state.slots.find(a=>a.service_type===s.service&&iso(a.slot_time)===s.time);
      const interval={starts_at:s.time,ends_at:new Date(Date.parse(s.time)+s.duration*60000)};
      const result=Date.parse(s.time)<=Date.now()?'past':existing?.protected?'protected':
        state.breaks.some(b=>b.source_type!=='template'&&overlaps(b,interval))?'blocked':
        state.appointments.some(a=>overlaps(a,interval))?'blocked':existing?'existing':'created';
      counts[result]++;
      return {...s,result};
    }):[];
    return {day,hours,exception:!!exception,conflicts,starts};
  });
  if(days.reduce((n,d)=>n+d.starts.length,0)>5000) throw new ScheduleError('За один раз можно обработать не более 5000 окон');
  counts.unchanged=counts.existing+counts.protected+counts.blocked+counts.past;
  return {token:hash({template,state,dates,counts}),counts,days,template};
}

export async function applyTemplate(templateId:string,dates:string[],token:string,requestKey:string) {
  if(!UUID.test(requestKey)) throw new ScheduleError('Некорректный ключ операции');
  return withScheduleTransaction(async client=>{
    const inputHash=hash({templateId,dates});
    const prior=(await client.query('SELECT input_hash,result FROM schedule_operations WHERE request_key=$1',[requestKey])).rows[0];
    if(prior) {
      if(prior.input_hash!==inputHash) throw new ScheduleError('Ключ уже использован',409);
      return prior.result;
    }
    const preview=await previewTemplate(client,templateId,dates);
    if(preview.token!==token) throw new ScheduleError('Шаблон или расписание изменились. Повторите предпросмотр.',409);
    if(preview.counts.conflicts) throw new ScheduleError('Есть действующие записи в закрываемом времени',409);
    for(const day of preview.days) {
      if(day.exception) continue;
      await setDayRule(client,day.day,day.hours,preview.template.name,'template',templateId);
    }
    const created=await insertStarts(client,preview.days.flatMap(d=>d.starts.filter(s=>s.result==='created')));
    await refreshSlotOccupancy(client);
    const result={...preview.counts,created,dates};
    await client.query('INSERT INTO schedule_operations(request_key,input_hash,result) VALUES($1,$2,$3)',[requestKey,inputHash,result]);
    return result;
  });
}

export async function copyDayPlan(client:PoolClient,source:string,dates:string[]):Promise<SchedulePlan> {
  validDay(source);
  const day=(await client.query('SELECT mode,hours FROM schedule_days WHERE day=$1',[source])).rows[0];
  if(day?.mode==='closed') throw new ScheduleError('Исходный день закрыт. Для копирования выходного используйте исключения.');
  if(day?.hours) return {dates,hours:normalizeHours(day.hours),reason:`Копия рабочего дня ${source}`};
  const slots=(await client.query('SELECT service_type,slot_time,duration_minutes FROM slots WHERE slot_time>=$1 AND slot_time<$2 ORDER BY slot_time',[moscowInstant(source,0),moscowInstant(source,1440)])).rows;
  if(!slots.length) throw new ScheduleError('В исходном дне нет опубликованных окон');
  const times=slots.map(s=>minutes(formatMoscow(s.slot_time,'HH:mm')));
  const starts=[...new Set(times)].sort((a,b)=>a-b);
  let step=starts.length>1?starts.slice(1).reduce((n,t,i)=>Math.min(n,t-starts[i]),240):Math.min(...slots.map(s=>s.duration_minutes));
  step=Math.max(15,Math.min(240,step));
  const end=Math.max(...slots.map((s,i)=>times[i]+s.duration_minutes));
  if(end>=1440) throw new ScheduleError('Для копирования дня с приёмом через полночь задайте рабочие часы явно');
  const pauses=(await client.query("SELECT starts_at,ends_at FROM schedule_breaks WHERE source_type='manual' AND starts_at>=$1 AND ends_at<=$2 ORDER BY starts_at",[moscowInstant(source,starts[0]),moscowInstant(source,end)])).rows;
  return {dates,hours:normalizeHours({start:clock(starts[0]),end:clock(end),step,services:[...new Set(slots.map(s=>s.service_type))],breaks:pauses.map(b=>({start:formatMoscow(b.starts_at,'HH:mm'),end:formatMoscow(b.ends_at,'HH:mm')}))}),reason:`Копия рабочего диапазона ${source}; проверьте альтернативные начала`};
}

export async function changeWindows(ids:string[],closed:boolean) {
  if(!ids.length||ids.length>5000||ids.some(id=>!UUID.test(id)))throw new ScheduleError('Выберите от 1 до 5000 окон');
  return withScheduleTransaction(async client=>{
    const selected=(await client.query('SELECT id,slot_time AS starts_at,slot_time+duration_minutes*interval \'1 minute\' AS ends_at FROM slots WHERE id=ANY($1::uuid[]) AND slot_time>now() ORDER BY id FOR UPDATE',[ids])).rows;
    if(selected.length!==new Set(ids.map(id=>id.toLowerCase())).size) throw new ScheduleError('Часть окон отсутствует или уже прошла. Обновите расписание.',409);
    let changed=0;
    if(closed) {
      const appointments=(await client.query(`SELECT * FROM (${appointmentsSql}) a`)).rows;
      if(selected.some(s=>appointments.some(a=>overlaps(s,a))))throw new ScheduleError('Закрываемое время пересекается с записью. Перенесите или отмените её отдельно.',409);
      for(const s of selected) {
        const inserted=await client.query(`INSERT INTO schedule_breaks(starts_at,ends_at,reason,source_type,source_key)
          SELECT $1,$2,'Окно закрыто администратором','window',$3 WHERE NOT EXISTS(SELECT 1 FROM schedule_breaks WHERE source_type='window' AND source_key=$3) RETURNING id`,[s.starts_at,s.ends_at,s.id]);
        changed+=inserted.rowCount??0;
      }
    } else {
      const removed=await client.query("DELETE FROM schedule_breaks WHERE source_type='window' AND source_key=ANY($1::text[]) RETURNING id",[selected.map(s=>s.id)]);changed=removed.rowCount??0;
    }
    await refreshSlotOccupancy(client);
    return {changed,closed};
  });
}
