import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { loadJourney, type JourneyService } from '@/lib/booking-journey';
import { deliverTransactionalEmail } from '@/lib/notifications';
import { notificationTemplate } from '@/lib/notification-templates';
import { deliverMax,type MaxRecipient } from '@/lib/max-notifications';
import type { ProviderResult } from '@/lib/notification-result';

export const emailV1Enabled = () => process.env.NOTIFICATIONS_EMAIL_V1_ENABLED === 'true';
export const maxV1Enabled = () => process.env.NOTIFICATIONS_MAX_V1_ENABLED === 'true';
export type NotificationKind = 'created'|'confirmed'|'rescheduled'|'cancelled'|'paid'|'reminder_24h'|'reminder_2h'|'reset_requested'|'password_changed'|'delivery_alert';
type Row = {id:string;booking_id:string|null;service_type:JourneyService|null;account_user_id:string|null;recipient_role:'client'|'admin';event_type:NotificationKind;revision:number;channel:'email'|'max';attempts:number;payload:Record<string,unknown>;scheduled_at:Date;created_at:Date};
const isReminder = (kind:string) => kind === 'reminder_24h' || kind === 'reminder_2h';
const errors = new Set(['channel_not_configured','contact_missing','provider_outcome_unknown','provider_rate_limited','provider_unavailable','provider_rejected','attempts_exhausted','worker_interrupted','smtp_budget_exhausted','smtp_budget_unavailable','smtp_budget_not_configured','smtp_budget_policy_mismatch']);

async function channelBoundary(client:PoolClient,channel:'email'|'max'){
  const value=process.env[channel==='email'?'NOTIFICATIONS_EMAIL_V1_ACTIVE_SINCE':'NOTIFICATIONS_MAX_V1_ACTIVE_SINCE'];
  if(!value||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||Date.parse(value)>Date.now()+60000)return null;
  const result=await client.query(`INSERT INTO notification_channel_activation(channel,activated_at) VALUES($1,$2)
    ON CONFLICT(channel) DO UPDATE SET activated_at=GREATEST(notification_channel_activation.activated_at,EXCLUDED.activated_at)
    RETURNING activated_at`,[channel,value]);
  return new Date(result.rows[0].activated_at).getTime()===Date.parse(value)?Date.parse(value):null;
}

async function enqueue(client:PoolClient, input:{service?:JourneyService;bookingId?:string;userId?:string;kind:NotificationKind;revision:number;key:string;at?:Date;payload?:Record<string,unknown>}) {
  for (const channel of ['email','max'] as const) {
    if (channel==='email' ? !emailV1Enabled() : !maxV1Enabled() || !input.bookingId) continue;
    if(await channelBoundary(client,channel)===null)continue;
    if(channel==='email'&&input.kind==='reminder_24h'&&(await client.query(`SELECT 1 FROM appointment_notifications WHERE engine='legacy' AND booking_id=$1 AND service_type=$2
      AND event_type='reminder' AND revision=$3 AND channel='email' AND status NOT IN ('cancelled','failed','not_configured') LIMIT 1`,[input.bookingId,input.service,input.revision])).rowCount)continue;
    if(channel==='max'&&(!input.userId||!(await client.query('SELECT 1 FROM max_account_bindings WHERE account_user_id=$1',[input.userId])).rowCount))continue;
    await client.query(`INSERT INTO appointment_notifications
      (engine,event_key,booking_id,service_type,account_user_id,event_type,revision,channel,scheduled_at,next_attempt_at,payload)
      VALUES('v1',$1,$2,$3,$4,$5,$6,$7,$8,$8,$9) ON CONFLICT DO NOTHING`,
      [`v1:${input.key}:${channel}`,input.bookingId||null,input.service||null,input.userId||null,input.kind,input.revision,channel,input.at||new Date(),JSON.stringify(input.payload||{})]);
  }
}
export async function enqueueAccountNotification(client:PoolClient,userId:string,kind:'reset_requested'|'password_changed',key:string,payload:Record<string,unknown>={}) {
  await enqueue(client,{userId,kind,key,revision:0,payload});
}
export async function enqueueOrderNotification(client:PoolClient,orderId:string){
  if(!emailV1Enabled())return;
  const order=(await client.query('SELECT account_user_id,status FROM orders WHERE id=$1',[orderId])).rows[0];
  if(!order||!['paid','shipped','delivered'].includes(order.status))return;
  await enqueue(client,{userId:order.account_user_id||undefined,kind:'paid',key:`order:${orderId}:paid`,revision:0,payload:{orderId}});
}
export async function enqueueBookingNotification(client:PoolClient,service:JourneyService,id:string,kind:NotificationKind,options:{at?:Date;key?:string;payload?:Record<string,unknown>}={}) {
  if(!emailV1Enabled()&&!maxV1Enabled())return;
  const booking=await loadJourney(service,id,client);if(!booking)return;
  const key=options.key||`${service}:${id}:${kind}:${kind==='paid'?'settled':booking.notification_revision}`;
  await enqueue(client,{service,bookingId:id,userId:booking.account_user_id||undefined,kind,revision:booking.notification_revision,
    key,at:options.at,payload:options.payload});
  if(['created','cancelled','rescheduled','paid'].includes(kind)||(kind==='confirmed'&&booking.notification_revision===0)){
    await enqueueAdminNotification(client,kind,key,{bookingId:id,service,...options.payload});
  }
}
async function enqueueAdminNotification(client:PoolClient,kind:NotificationKind,key:string,payload:Record<string,unknown>={}){
  if(!maxV1Enabled())return;
  if(await channelBoundary(client,'max')===null)return;
  // Dedicated role and explicit verified binding; never route admin facts through a customer account.
  await client.query(`INSERT INTO appointment_notifications(engine,event_key,recipient_role,event_type,revision,channel,scheduled_at,next_attempt_at,payload)
    SELECT 'v1',$1,'admin',$2,0,'max',now(),now(),$3 WHERE EXISTS(SELECT 1 FROM max_admin_binding)
    ON CONFLICT DO NOTHING`,[`v1:admin:${key}`,kind,JSON.stringify(payload)]);
}
export async function scheduleV1Reminders(client:PoolClient,service:JourneyService,id:string) {
  if(!emailV1Enabled()&&!maxV1Enabled())return;
  const b=await loadJourney(service,id,client);if(!b||b.status!=='confirmed')return;
  for(const [kind,hours] of [['reminder_24h',24],['reminder_2h',2]] as const){
    const at=new Date(new Date(b.slot_time).getTime()-hours*3600000);
    // No immediate catch-up for reminders whose due time has already passed.
    if(at.getTime()>Date.now())await enqueueBookingNotification(client,service,id,kind,{at});
  }
}

async function resolvePayload(client:PoolClient,row:Row){
  const boundary=await channelBoundary(client,row.channel);
  if(boundary===null||new Date(row.created_at).getTime()<boundary)return null;
  if(!isReminder(row.event_type)&&Date.now()-new Date(row.created_at).getTime()>30*60000)return null;
  if(row.recipient_role==='admin'){
    const binding=(await client.query('SELECT max_chat_id,confirmed_at::text AS binding_version FROM max_admin_binding')).rows[0];
    if(!binding)return null;
    const message=notificationTemplate('delivery_alert',{accountUrl:'https://body-state.ru/admin/notifications'});
    if(row.event_type!=='delivery_alert'){
      const labels:Partial<Record<NotificationKind,string>>={created:'Новая запись',confirmed:'Новая запись',cancelled:'Отмена записи',rescheduled:'Перенос записи',paid:'Оплата подтверждена'};
      message.text=`Body State: ${labels[row.event_type]||'Событие записи'}. Подробности — https://body-state.ru/admin/bookings`;
    }
    return {recipient:binding.max_chat_id,message,maxRecipient:{role:'admin',boundAt:binding.binding_version} as MaxRecipient};
  }
  let booking:Record<string,unknown>|null=null;
  if(row.booking_id&&row.service_type){
    booking=await loadJourney(row.service_type,row.booking_id,client);
    if(!booking)return null;
    if(row.event_type!=='paid'&&Number(booking.notification_revision)!==row.revision)return null;
    if(row.event_type==='paid'&&booking.payment_status!=='paid')return null;
    if(row.event_type==='cancelled'?booking.status!=='cancelled':row.event_type!=='paid'&&!['pending','confirmed'].includes(String(booking.status)))return null;
    if(row.event_type==='confirmed'&&booking.status!=='confirmed')return null;
    if(row.event_type==='created'&&booking.status!=='pending')return null;
    if(isReminder(row.event_type)){
      if(booking.status!=='confirmed'||new Date(String(booking.slot_time)).getTime()<=Date.now()||Date.now()-new Date(row.scheduled_at).getTime()>5*60000)return null;
      if(booking.account_user_id){
        const setting=await client.query('SELECT reminders_24h,reminders_2h FROM account_notification_settings WHERE account_user_id=$1',[booking.account_user_id]);
        if(setting.rows[0]?.[row.event_type==='reminder_24h'?'reminders_24h':'reminders_2h']===false)return null;
      }
    }
  }
  let order:Record<string,unknown>|null=null;
  if(row.payload.orderId){
    order=(await client.query('SELECT status,receipt_email FROM orders WHERE id=$1',[row.payload.orderId])).rows[0];
    if(!order||!['paid','shipped','delivered'].includes(String(order.status)))return null;
  }
  const userId=booking?.account_user_id||row.account_user_id;
  const user=userId?(await client.query('SELECT email,display_name FROM account_users WHERE id=$1 AND disabled_at IS NULL',[userId])).rows[0]:null;
  if(userId&&!user)return null;
  let recipient=String(user?.email||booking?.client_email||order?.receipt_email||'');
  let maxRecipient:MaxRecipient|undefined;
  if(row.channel==='max'){
    const binding=userId?(await client.query('SELECT max_chat_id,created_at::text AS binding_version FROM max_account_bindings WHERE account_user_id=$1',[userId])).rows[0]:null;
    recipient=binding?.max_chat_id||'';
    if(binding)maxRecipient={role:'client',accountUserId:String(userId),boundAt:binding.binding_version};
  }
  const data:Record<string,unknown>={name:user?.display_name||booking?.client_name,slotTime:booking?.slot_time?new Date(String(booking.slot_time)).toISOString():undefined,
    serviceTitle:({bfm:'Физическая реабилитация',brt:'БРТ',psychology:'Психологическая реабилитация'} as Record<string,string>)[row.service_type||''],
    status:booking?.status,oldTime:row.payload.oldTime,accountUrl:'https://body-state.ru/account'};
  if(row.event_type==='reset_requested'){
    const reset=await client.query('SELECT id,token_hash FROM account_password_reset_tokens WHERE id=$1 AND account_user_id=$2 AND used_at IS NULL AND expires_at>now()',[row.payload.resetId,row.account_user_id]);
    if(!reset.rows[0])return null;
    // Loaded only for this event; never persist or log the plaintext URL.
    const { createNotificationResetToken,resetTokenHash }=await import('@/lib/notification-reset');
    const token=createNotificationResetToken(String(row.payload.resetId));
    if(resetTokenHash(token)!==reset.rows[0].token_hash)return null;
    data.resetUrl=`https://body-state.ru/account/reset-password?token=${encodeURIComponent(token)}`;
  }
  if(!booking&&!user&&!order)return null;
  const message=notificationTemplate(row.event_type,data);
  if(row.channel==='max'){
    const time=booking?.slot_time?new Date(String(booking.slot_time)).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'';
    message.text=[message.subject,time?`Дата и время: ${time} (Москва).`:'',
      row.event_type==='rescheduled'&&row.payload.oldTime?`Прежнее время: ${new Date(String(row.payload.oldTime)).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} (Москва).`:'',
      'Подробности — в защищённом личном кабинете: https://body-state.ru/account'].filter(Boolean).join('\n');
  }
  return {recipient,message,maxRecipient};
}

export type V1Providers={email:typeof deliverTransactionalEmail;max:typeof deliverMax};
export async function processV1Notifications(limit=20,providers:V1Providers={email:deliverTransactionalEmail,max:deliverMax},timeoutMs=15000,budgetMs=20000){
  if(!emailV1Enabled()&&!maxV1Enabled())return {processed:0};
  const transaction = <T,>(fn:(client:PoolClient)=>Promise<T>)=>db.transaction(async client=>{
    await client.query("SET LOCAL statement_timeout='3s'");
    await client.query("SET LOCAL lock_timeout='1s'");
    return fn(client);
  });
  await transaction(client=>client.query(`UPDATE appointment_notifications SET
    status=CASE WHEN send_started_at IS NOT NULL THEN 'uncertain' WHEN attempts>=4 THEN 'failed' ELSE 'retry' END,
    last_error=CASE WHEN send_started_at IS NOT NULL THEN 'worker_interrupted' WHEN attempts>=4 THEN 'attempts_exhausted' ELSE 'provider_unavailable' END,
    next_attempt_at=now()+interval '1 minute',updated_at=now()
    WHERE engine='v1' AND status='processing' AND processing_at<now()-interval '5 minutes'`));
  let processed=0;
  const deadline=Date.now()+budgetMs;
  for(let i=0;i<Math.min(Math.max(limit,0),50);i++){
    // Leave enough time for a full transport timeout and durable ACK handling.
    // A timed-out provider remains uncertain; Promise.race is not cancellation.
    if(Date.now()+timeoutMs+1000>deadline)break;
    const row=await transaction(async client=>{
      const r=await client.query<Row>(`SELECT * FROM appointment_notifications WHERE engine='v1' AND status IN ('queued','retry')
        AND scheduled_at<=now() AND next_attempt_at<=now() AND ((channel='email' AND $1) OR (channel='max' AND $2))
        ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,[emailV1Enabled(),maxV1Enabled()]);
      if(!r.rows[0])return null;
      await client.query(`UPDATE appointment_notifications SET status='processing',processing_at=now(),send_started_at=NULL,attempts=attempts+1,updated_at=now() WHERE id=$1`,[r.rows[0].id]);
      return {...r.rows[0],attempts:r.rows[0].attempts+1};
    });
    if(!row)break;
    let payload:Awaited<ReturnType<typeof resolvePayload>>;
    try{payload=await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const current=await client.query('SELECT status FROM appointment_notifications WHERE id=$1 FOR UPDATE',[row.id]);
      if(current.rows[0]?.status!=='processing')return null;
      const payload=await resolvePayload(client,row);
      if(!payload){await client.query(`UPDATE appointment_notifications SET status='cancelled',updated_at=now() WHERE id=$1`,[row.id]);return null;}
      if(Date.now()+timeoutMs+1000>deadline){
        await client.query(`UPDATE appointment_notifications SET status='retry',attempts=GREATEST(0,attempts-1),
          next_attempt_at=now()+interval '1 minute',updated_at=now() WHERE id=$1`,[row.id]);
        return null;
      }
      await client.query('UPDATE appointment_notifications SET send_started_at=now() WHERE id=$1',[row.id]);
      return payload;
    });}catch{
      await transaction(client=>client.query(`UPDATE appointment_notifications SET status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'retry' END,
        last_error=CASE WHEN attempts>=4 THEN 'attempts_exhausted' ELSE 'provider_unavailable' END,
        next_attempt_at=now()+$2*interval '1 second',updated_at=now() WHERE id=$1 AND status='processing' AND send_started_at IS NULL`,[row.id,60*2**(row.attempts-1)]));
      processed++;continue;
    }
    if(!payload){processed++;continue;}
    if(Date.now()+timeoutMs+1000>deadline){
      await transaction(client=>client.query(`UPDATE appointment_notifications SET status='retry',send_started_at=NULL,
        attempts=GREATEST(0,attempts-1),next_attempt_at=now()+interval '1 minute',updated_at=now()
        WHERE id=$1 AND status='processing'`,[row.id]));
      break;
    }
    let timer:ReturnType<typeof setTimeout>|undefined;
    let result:ProviderResult;
    try{
      if(!payload.recipient)result={status:'failed',error:'contact_missing'};
      else result=await Promise.race([
        row.channel==='email'?providers.email(payload.recipient,payload.message.subject,payload.message.html,payload.message.text,{deadlineAt:Math.min(deadline-1000,Date.now()+timeoutMs)}):providers.max(payload.recipient,payload.message.text,payload.maxRecipient),
        new Promise<ProviderResult>(resolve=>{timer=setTimeout(()=>resolve({status:'uncertain',error:'provider_outcome_unknown'}),timeoutMs);})
      ]);
    }catch{result={status:'uncertain',error:'provider_outcome_unknown'};}
    finally{if(timer)clearTimeout(timer);}
    // These local budget outcomes prove transport was never invoked. Do not
    // exhaust provider attempts simply because the shared rolling quota is full.
    if(row.channel==='email'&&['smtp_budget_exhausted','smtp_budget_unavailable'].includes(result.error||'')&&result.status==='retry'){
      const wait=Number.isFinite(result.retryAfterSeconds)?Math.max(60,Math.min(86400,Math.ceil(result.retryAfterSeconds!))):60;
      await transaction(client=>client.query(`UPDATE appointment_notifications SET status='retry',send_started_at=NULL,
        attempts=GREATEST(0,attempts-1),last_error=$2,next_attempt_at=now()+$3*interval '1 second',updated_at=now()
        WHERE id=$1 AND status='processing'`,[row.id,result.error,wait]));
      processed++;break;
    }
    const status=result.status==='retry'&&row.attempts>=4?'failed':result.status;
    const error=result.status==='retry'&&row.attempts>=4?'attempts_exhausted':errors.has(result.error||'')?result.error:null;
    await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const current=(await client.query('SELECT status FROM appointment_notifications WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
      const resolved=await resolvePayload(client,row);
      const stale=current?.status!=='processing'||!resolved||
        (row.channel==='max'&&(resolved.recipient!==payload.recipient||resolved.maxRecipient?.boundAt!==payload.maxRecipient?.boundAt));
      await client.query(`UPDATE appointment_notifications SET status=CASE WHEN status<>'processing' OR $6 THEN 'uncertain' ELSE $2 END,
      last_error=CASE WHEN status<>'processing' OR $6 THEN 'provider_outcome_unknown' ELSE $3 END,
      provider_message_id=$4,accepted_at=CASE WHEN $2 IN ('accepted','delivered') THEN now() ELSE accepted_at END,
      next_attempt_at=now()+$5*interval '1 second',updated_at=now() WHERE id=$1`,
      [row.id,status,error,result.id?.slice(0,128)||null,Math.min(3600,60*2**(row.attempts-1)),stale]);
    });
    if(status==='failed'&&row.attempts>=4&&row.event_type!=='delivery_alert'){
      await transaction(client=>enqueueAdminNotification(client,'delivery_alert',`delivery-alert:${row.id}`));
    }
    processed++;
  }
  return {processed};
}

export async function retryV1Notification(id:string){
  return db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
    const row=(await client.query<Row&{status:string;send_started_at:Date|null}>('SELECT * FROM appointment_notifications WHERE id=$1 AND engine=\'v1\' FOR UPDATE',[id])).rows[0];
    // Unknown/accepted/sending or exhausted attempts never receive a blind manual resend.
    if(!row||!['failed','not_configured'].includes(row.status)||row.attempts>=4||row.event_type==='reset_requested'||!await resolvePayload(client,row))return false;
    await client.query(`UPDATE appointment_notifications SET status='queued',last_error=NULL,next_attempt_at=GREATEST(scheduled_at,now()),updated_at=now() WHERE id=$1`,[id]);return true;
  });
}
