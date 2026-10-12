import type { PoolClient } from 'pg';
import { db, pool } from '@/lib/db';
import { deliverEmail } from '@/lib/notifications';
import { deliverSMS } from '@/lib/sms';
import type { ProviderResult } from '@/lib/notification-result';
import { JOURNEY_SERVICES, loadJourney, type JourneyService } from '@/lib/booking-journey';

type EventType='created'|'confirmed'|'rescheduled'|'cancelled'|'reminder';
type NotificationRow={id:string;booking_id:string;service_type:JourneyService;event_type:EventType;revision:number;channel:'sms'|'email';attempts:number};
const safeErrors=new Set(['channel_not_configured','contact_missing','provider_outcome_unknown','provider_rate_limited','provider_unavailable','provider_rejected','attempts_exhausted','worker_interrupted']);
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function appointmentMessage(kind:EventType, b:Record<string,unknown>) {
  const confirmed=b.status==='confirmed',paid=b.payment_status==='paid';
  const titles={created:'Заявка на запись получена',confirmed:'Запись подтверждена',rescheduled:'Запись перенесена',cancelled:'Запись отменена',reminder:'Напоминание о записи'};
  const date=new Date(String(b.slot_time)).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'short'});
  const payment=paid?'Оплата получена.':b.payment_option==='at_appointment'?'Оплата — на приёме.':confirmed?'Онлайн-оплата ещё не подтверждена.':'Для подтверждения записи завершите онлайн-оплату.';
  const text=kind==='cancelled'?'Запись отменена.':`${titles[kind]}. ${date} (Москва). ${confirmed?'Время закреплено за вами. ':''}${payment} Управление записью — в личном кабинете.`;
  return {subject:titles[kind],text,html:`<div style="font-family:Arial,sans-serif;padding:24px"><h2>${titles[kind]}</h2><p>${esc(text)}</p></div>`};
}
export async function enqueueAppointment(client:PoolClient,service:JourneyService,id:string,kind:EventType, scheduledAt?:Date) {
  const b=await loadJourney(service,id,client); if(!b)return;
  const planned=scheduledAt||new Date();
  for(const channel of ['sms','email']) await client.query(`INSERT INTO appointment_notifications(booking_id,service_type,event_type,revision,channel,scheduled_at,next_attempt_at)
    VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING`,[id,service,kind,b.notification_revision,channel,planned]);
}
export async function invalidateAppointmentNotifications(client:PoolClient,service:JourneyService,id:string) {
  await client.query(`UPDATE appointment_notifications SET
    status=CASE WHEN status='processing' AND send_started_at IS NOT NULL THEN 'uncertain' ELSE 'cancelled' END,
    last_error=CASE WHEN status='processing' AND send_started_at IS NOT NULL THEN 'provider_outcome_unknown' ELSE last_error END,
    updated_at=now() WHERE booking_id=$1 AND service_type=$2 AND status IN ('queued','retry','processing','failed','not_configured')`,[id,service]);
  await client.query(`UPDATE ${service}_bookings SET notification_revision=notification_revision+1 WHERE id=$1`,[id]);
}
export async function scheduleReminder(client:PoolClient,service:JourneyService,id:string) {
  const b=await loadJourney(service,id,client);
  if(!b || b.status!=='confirmed' || new Date(b.slot_time)<=new Date())return;
  const at=new Date(Math.max(Date.now(),new Date(b.slot_time).getTime()-24*3600000));
  await enqueueAppointment(client,service,id,'reminder',at);
}
export async function syncReminders() {
  await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
    for(const service of JOURNEY_SERVICES) {
      const r=await client.query(`SELECT b.id FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status='confirmed' AND s.slot_time>now() AND s.slot_time<now()+interval '25 hours' AND b.reminder_sent_at IS NULL`);
      for(const b of r.rows)await scheduleReminder(client,service,b.id);
    }
  });
}
export type NotificationProviders={sms:typeof deliverSMS;email:typeof deliverEmail};
function isCurrent(row:NotificationRow,b:Record<string,unknown>|null){
  if(!b||b.notification_revision!==row.revision)return false;
  if(row.event_type==='reminder')return b.status==='confirmed'&&new Date(String(b.slot_time))>new Date();
  if(row.event_type==='cancelled')return b.status==='cancelled';
  if(row.event_type==='confirmed')return b.status==='confirmed';
  if(row.event_type==='created'&&b.status!=='pending')return false;
  if(!['pending','confirmed'].includes(String(b.status)))return false;
  return !(b.status==='pending'&&b.hold_expires_at&&new Date(String(b.hold_expires_at))<=new Date());
}
export async function processNotificationQueue(limit=20,providers:NotificationProviders={sms:deliverSMS,email:deliverEmail},providerTimeoutMs=15_000) {
  // An interrupted send can have been accepted remotely. Never automatically resend it.
  await pool.query(`UPDATE appointment_notifications SET status='uncertain',last_error='worker_interrupted',updated_at=now() WHERE status='processing' AND processing_at<now()-interval '5 minutes'`);
  let processed=0;
  for(let n=0;n<Math.min(limit,50);n++) {
    const row=await db.transaction(async client=>{
      const r=await client.query<NotificationRow>(`SELECT * FROM appointment_notifications WHERE status IN ('queued','retry') AND scheduled_at<=now() AND next_attempt_at<=now() ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`);
      if(!r.rows[0])return null;
      await client.query(`UPDATE appointment_notifications SET status='processing',processing_at=now(),send_started_at=NULL,attempts=attempts+1,updated_at=now() WHERE id=$1`,[r.rows[0].id]);
      return {...r.rows[0],attempts:r.rows[0].attempts+1};
    });
    if(!row)break;
    const payload=await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const current=await client.query(`SELECT status FROM appointment_notifications WHERE id=$1 FOR UPDATE`,[row.id]);
      if(current.rows[0]?.status!=='processing')return null;
      const b=await loadJourney(row.service_type,row.booking_id,client);
      const stale=!isCurrent(row,b);
      if(stale){await client.query(`UPDATE appointment_notifications SET status='cancelled',updated_at=now() WHERE id=$1`,[row.id]);return null;}
      await client.query('UPDATE appointment_notifications SET send_started_at=now() WHERE id=$1',[row.id]);
      return {message:appointmentMessage(row.event_type,b),phone:b.client_phone,email:b.client_email};
    });
    if(!payload) {processed++;continue;}
    // The provider never holds a PostgreSQL connection or the shared scheduling lock.
    // A timeout cannot prove rejection and must never create an automatic resend.
    let result:ProviderResult;
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const send=row.channel==='sms'?(payload.phone?providers.sms(payload.phone,payload.message.text):Promise.resolve<ProviderResult>({status:'failed',error:'contact_missing'})):
        (payload.email?providers.email(payload.email,payload.message.subject,payload.message.html):Promise.resolve<ProviderResult>({status:'failed',error:'contact_missing'}));
      result=await Promise.race([send,new Promise<ProviderResult>(resolve=>{timer=setTimeout(()=>resolve({status:'uncertain',error:'provider_outcome_unknown'}),providerTimeoutMs);})]);
    } catch {result={status:'uncertain',error:'provider_outcome_unknown'};}
    finally {if(timer) clearTimeout(timer);}
    await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const current=await client.query('SELECT status FROM appointment_notifications WHERE id=$1 FOR UPDATE',[row.id]);
      const b=await loadJourney(row.service_type,row.booking_id,client);
      // An in-flight stale send is retained as uncertain, not reported as a current reminder.
      if(current.rows[0]?.status!=='processing'||!isCurrent(row,b)) {
        await client.query(`UPDATE appointment_notifications SET status='uncertain',last_error='provider_outcome_unknown',
          provider_message_id=$2,updated_at=now() WHERE id=$1 AND send_started_at IS NOT NULL`,[row.id,result.id?.slice(0,128)||null]);
        return;
      }
      const status=result.status==='retry'&&row.attempts>=4?'failed':result.status;
      const error=row.attempts>=4&&result.status==='retry'?'attempts_exhausted':safeErrors.has(result.error||'')?result.error:null;
      await client.query(`UPDATE appointment_notifications SET status=$2,last_error=$3,provider_message_id=$4,next_attempt_at=now()+$5*interval '1 second',
        accepted_at=CASE WHEN $2 IN ('accepted','delivered') THEN now() ELSE accepted_at END,delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,updated_at=now() WHERE id=$1`,[row.id,status,error,result.id?.slice(0,128)||null,Math.min(3600,60*2**(row.attempts-1))]);
    });
    processed++;
  }
  return {processed};
}
export async function requeueNotification(id:string) {
  return db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
    const r=await client.query<NotificationRow & {status:string}>(`SELECT * FROM appointment_notifications WHERE id=$1 FOR UPDATE`,[id]);
    const row=r.rows[0]; if(!row||!['failed','not_configured'].includes(row.status))return false;
    const b=await loadJourney(row.service_type,row.booking_id,client);
    if(!isCurrent(row,b))return false;
    await client.query(`UPDATE appointment_notifications SET status='queued',last_error=NULL,next_attempt_at=GREATEST(scheduled_at,now()),updated_at=now() WHERE id=$1`,[id]); return true;
  });
}
