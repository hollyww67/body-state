import { NextRequest, NextResponse } from "next/server";
import {createHash} from 'node:crypto';
import { db } from "@/lib/db";
import { requireAdmin } from '@/lib/admin-auth';
import { claimSlot, rescheduleBooking, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";
import { CONSENT_VERSION } from "@/lib/legal";
import { cleanText, normalizePhone, readJsonObject } from "@/lib/request";
import { updateAdminBooking, BookingActionError } from "@/lib/admin-bookings";
import { dateRange,dayAfter,moscowInstant,ScheduleError,validDay } from '@/lib/schedule-plan';

export async function GET(request:NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  try {
    const q=request.nextUrl.searchParams,from=q.get('from'),to=q.get('to'),id=q.get('id');
    if((from&&!to)||(!from&&to)) throw new ScheduleError('Укажите обе границы периода');
    if(from&&to&&dateRange(validDay(from),validDay(to)).length>93) throw new ScheduleError('Выберите не более 93 дней');
    const offset=Number(q.get('offset')??0),limit=Number(q.get('limit')??500);
    const status=q.get('status');
    if(status&&!['new','pending','confirmed','cancelled','completed'].includes(status))throw new ScheduleError('Некорректный статус');
    const search=(q.get('q')??'').trim().slice(0,120).toLowerCase();
    const searchPattern=search?`%${search.replace(/[\\%_]/g,'\\$&')}%`:null;
    if(!Number.isInteger(offset)||offset<0||offset>100000||!Number.isInteger(limit)||limit<1||limit>1000) throw new ScheduleError('Некорректная страница');
    const result=await db.transaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const shared='b.id,b.client_name,b.client_phone,b.client_email,b.client_tg,b.status,b.attendance,b.payment_option,b.payment_status,b.created_at,b.slot_id,b.consent_version,b.consent_at,b.account_user_id,b.archived_at';
      const sources=['bfm','brt','psychology'].map(service=>`SELECT to_jsonb(r) AS data FROM (
        SELECT ${shared},'${service}' AS service_type,s.slot_time,s.duration_minutes
        ${service==='psychology'?',b.booking_type,b.room_id,b.program_id':''}
        FROM ${service}_bookings b LEFT JOIN slots s ON s.id=b.slot_id) r`);
      sources.push(`SELECT to_jsonb(r) AS data FROM (SELECT id,client_name,client_phone,notes,status,attendance,created_at,consent_version,consent_at,account_user_id,archived_at,'program' AS service_type,NULL::timestamptz AS slot_time FROM program_enrollments) r`);
      sources.push(`SELECT to_jsonb(r) AS data FROM (SELECT id,name AS client_name,phone AS client_phone,message AS notes,source,status,attendance,created_at,consent_version,consent_at,account_user_id,archived_at,'consultation' AS service_type,NULL::timestamptz AS slot_time FROM consultation_enrollments) r`);
      const filtered=`WITH all_bookings AS (${sources.join(' UNION ALL ')}), filtered AS (SELECT data FROM all_bookings
        WHERE ($1::boolean OR data->>'archived_at' IS NULL)
          AND ($2::text IS NULL OR data->>'id'=$2)
          AND ($3::timestamptz IS NULL OR COALESCE((data->>'slot_time')::timestamptz,(data->>'created_at')::timestamptz)>=$3)
          AND ($4::timestamptz IS NULL OR COALESCE((data->>'slot_time')::timestamptz,(data->>'created_at')::timestamptz)<$4)
          AND ($5::text IS NULL OR data->>'status'=$5)
          AND ($6::text IS NULL OR data->>'client_name' ILIKE $6 OR data->>'client_email' ILIKE $6 OR data->>'client_phone' ILIKE $6))`;
      const args=[q.get('archived')==='true',id,from?moscowInstant(from,0):null,to?moscowInstant(dayAfter(to),0):null,status,searchPattern];
      const rows=await client.query(`${filtered} SELECT data FROM filtered ORDER BY (data->>'created_at')::timestamptz DESC,data->>'id' LIMIT $7 OFFSET $8`,[...args,limit+1,offset]);
      const counts=(await client.query(`${filtered} SELECT count(*)::int total,
        count(*) FILTER(WHERE data->>'status'='pending')::int pending,
        count(*) FILTER(WHERE ((data->>'slot_time')::timestamptz AT TIME ZONE 'Europe/Moscow')::date=(now() AT TIME ZONE 'Europe/Moscow')::date)::int today,
        count(*) FILTER(WHERE date_trunc('week',(data->>'slot_time')::timestamptz AT TIME ZONE 'Europe/Moscow')=date_trunc('week',now() AT TIME ZONE 'Europe/Moscow'))::int week,
        count(*) FILTER(WHERE data->>'booking_type'='online' AND data->>'status'='confirmed')::int online FROM filtered`,args)).rows[0];
      const events=id?(await client.query('SELECT * FROM booking_events WHERE booking_id::text=$1 ORDER BY id',[id])).rows:undefined;
      return {bookings:rows.rows.slice(0,limit).map(r=>r.data),events,counts,offset,limit,next_offset:rows.rows.length>limit?offset+limit:null};
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('[Admin booking] Load failed');
    return NextResponse.json({error:error instanceof ScheduleError?error.message:'Не удалось загрузить записи'},{status:error instanceof ScheduleError?error.status:500});
  }
}

export async function POST(request: NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 16_384); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const service = cleanText(body.service_type, 20);
  let slotId = cleanText(body.slot_id, 64);
  const slotTime = cleanText(body.slot_time, 64);
  const name = cleanText(body.client_name, 120);
  const phone = normalizePhone(body.client_phone);
  const accountId=cleanText(body.account_user_id,64);
  const requestKey=cleanText(body.request_key,64).toLowerCase();
  if(requestKey&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestKey))return NextResponse.json({error:'Некорректный ключ запроса'},{status:400});
  const inputHash=createHash('sha256').update(JSON.stringify({action:'admin-create-booking',service,slotId:slotId.toLowerCase(),slotTime:slotId?'':slotTime,name,phone,accountId:accountId.toLowerCase()})).digest('hex');
  if(accountId&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)||body.identity_confirmed!==true))return NextResponse.json({error:'Подтвердите личность выбранного клиента'},{status:400});
  if (!(["bfm", "brt", "psychology"] as string[]).includes(service) || (!slotId && !slotTime) || !name || !phone) {
    return NextResponse.json({ error: "Проверьте данные записи" }, { status: 400 });
  }
  if (body.consent_confirmed !== true) {
    return NextResponse.json({ error: "Подтвердите согласие клиента на обработку данных" }, { status: 400 });
  }

  if (!slotId) {
    const parsed = new Date(slotTime);
    if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return NextResponse.json({ error: "Выберите будущее время" }, { status: 400 });
  }
  try {
  const claimed = await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
    await client.query("SELECT set_config('body_state.actor','admin',true)");
    if(requestKey){
      const previous=(await client.query('SELECT input_hash,result FROM schedule_operations WHERE request_key=$1',[requestKey])).rows[0];
      if(previous){if(previous.input_hash!==inputHash)throw new BookingActionError('Ключ уже использован для другой операции',409);return {booking:previous.result.booking,created:false};}
    }
    const account=accountId?(await client.query('SELECT email FROM account_users WHERE id=$1 AND disabled_at IS NULL FOR SHARE',[accountId])).rows[0]:null;
    if(accountId&&!account)throw new BookingActionError('Личный кабинет недоступен',409);
    if(!slotId) {
      await client.query(`INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES($1,$2,$3)
        ON CONFLICT(slot_time,service_type) DO NOTHING`,[service,new Date(slotTime).toISOString(),SERVICE_DURATION_MINUTES[service as ServiceType]]);
      slotId=(await client.query('SELECT id::text FROM slots WHERE service_type=$1 AND slot_time=$2',[service,new Date(slotTime).toISOString()])).rows[0].id;
    }
    const result=await claimSlot(slotId, service as ServiceType, {
    client_name: name,
    client_phone: phone,
    client_email: account?.email??null,
    account_user_id: accountId||null,
    client_tg: null,
    ...(service === "psychology" ? { booking_type: "offline" } : {}),
    status: "confirmed",
    payment_option: "at_appointment",
    payment_status: "due",
    consent_version: CONSENT_VERSION,
    consent_at: new Date().toISOString(),
  },client);
    // claimSlot's normal result contract must not commit a newly created orphan window.
    if(!result.ok) throw new BookingActionError(result.error,result.status);
    if(requestKey)await client.query('INSERT INTO schedule_operations(request_key,input_hash,result) VALUES($1,$2,$3::jsonb)',[requestKey,inputHash,JSON.stringify({booking:{id:result.booking.id,status:result.booking.status}})]);
    return result;
  });
  return NextResponse.json({ booking: claimed.booking }, { status: claimed.created?201:200 });
  } catch(error) {
    if(error instanceof BookingActionError) return NextResponse.json({error:error.message},{status:error.status});
    console.error('[Admin booking] Creation failed');
    return NextResponse.json({error:'Не удалось создать запись'},{status:500});
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8192); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const { id, status, slot_id, service_type } = body;
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  if (slot_id) {
    if (!["bfm", "brt", "psychology"].includes(String(service_type))) return NextResponse.json({ error: "Некорректная услуга" }, { status: 400 });
    const result = await rescheduleBooking({ bookingId: String(id), serviceType: service_type as ServiceType, newSlotId: String(slot_id),actor:'admin',reason:cleanText(body.reason,500) });
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
  const unauthorized=await requireAdmin(request); if(unauthorized) return unauthorized;
  let body:Record<string,unknown>;
  try {body=await readJsonObject(request,8192);} catch {return NextResponse.json({error:'Некорректный JSON'},{status:400});}
  const {id}=body;
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  try {
    return await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      await client.query("SELECT set_config('body_state.actor','admin',true),set_config('body_state.reason',$1,true)",[cleanText(body.reason,500)]);
      for(const table of ['program_enrollments','consultation_enrollments','bfm_bookings','brt_bookings','psychology_bookings']) {
        const found=await client.query(`SELECT status FROM ${table} WHERE id::text=$1 FOR UPDATE`,[String(id)]);
        if(!found.rows[0]) continue;
        if(!['completed','cancelled'].includes(found.rows[0].status)) return NextResponse.json({error:'Архивировать можно только завершённую или отменённую запись'},{status:409});
        await client.query(`UPDATE ${table} SET archived_at=COALESCE(archived_at,now()) WHERE id::text=$1`,[String(id)]);
        return NextResponse.json({ok:true,archived:true});
      }
      return NextResponse.json({error:'Заявка не найдена'},{status:404});
    });
  } catch {return NextResponse.json({error:'Не удалось архивировать запись'},{status:500});}
}
