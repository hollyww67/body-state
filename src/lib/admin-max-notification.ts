import type { PoolClient } from 'pg';
import { isJourneyService, validBookingId, loadJourney, type JourneyService } from '@/lib/booking-journey';

export type AdminBookingEvent = 'created'|'confirmed'|'rescheduled'|'cancelled'|'paid';
type Message = {subject:string;html:string;text:string};
export type AdminBookingResult = {message:Message}|{rejected:'admin_event_invalid'|'admin_booking_unavailable'}|null;
const titles:Record<AdminBookingEvent,string>={created:'📅 Новая запись — Body State',confirmed:'✅ Запись подтверждена',rescheduled:'🔄 Запись перенесена',cancelled:'❌ Запись отменена',paid:'💳 Оплата подтверждена'};
const services:Record<JourneyService,string>={bfm:'Физическая реабилитация',brt:'БРТ',psychology:'Психологическая реабилитация'};
const statuses:Record<string,string>={pending:'Ожидает оплаты',confirmed:'Подтверждена',cancelled:'Отменена',completed:'Приём завершён'};
const invalid=():AdminBookingResult=>({rejected:'admin_event_invalid'});
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

// Separate opt-in/boundary: deploying code must never silently start sharing contacts.
export function adminMaxDetailsEnabled(createdAt:Date){
  const stamp=process.env.NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE;
  return process.env.NOTIFICATIONS_MAX_V1_ENABLED==='true'&&process.env.NOTIFICATIONS_MAX_V1_ADMIN_ONLY==='true'
    &&process.env.NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED==='true'&&typeof stamp==='string'
    &&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(stamp)&&Number.isFinite(Date.parse(stamp))
    &&Date.parse(stamp)<=Date.now()&&new Date(createdAt).getTime()>=Date.parse(stamp);
}
function time(value:unknown):Date|null{
  if(value instanceof Date)return Number.isFinite(value.getTime())?value:null;
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/i.test(value))return null;
  const date=new Date(value);return Number.isFinite(date.getTime())?date:null;
}
function field(value:unknown,max:number){
  if(typeof value!=='string')return '';
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,' ').replace(/https?:\/\/\S+|www\.\S+/gi,'[ссылка скрыта]')
    .replace(/[<>`\[\]\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function phone(value:unknown){
  if(typeof value!=='string'||value.length>60||/[\p{Cc}\p{Cf}]/u.test(value))return '';
  let digits=value.replace(/[\s().-]/g,'');if(!/^\+?\d{10,15}$/.test(digits))return '';
  digits=digits.replace(/^\+/,'');if(digits.length===10)digits='7'+digits;
  if(digits.length===11&&digits.startsWith('8'))digits='7'+digits.slice(1);
  return '+'+digits;
}
function email(value:unknown){
  if(typeof value!=='string'||value.length>254||/[\p{Cc}\p{Cf}]/u.test(value))return '';
  const v=value.trim();return /^[A-Z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,63}$/i.test(v)?v:'';
}
const date=(d:Date)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short'}).format(d);
const clock=(d:Date)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(d);

export function formatAdminMaxBooking(input:{kind:AdminBookingEvent;bookingId:string;service:JourneyService;booking:Record<string,unknown>;oldTime?:unknown;accountEmail?:unknown}):Message|null{
  if(!isJourneyService(input.service)||!validBookingId(input.bookingId)||!Object.hasOwn(titles,input.kind))return null;
  const slot=time(input.booking.slot_time);if(!slot)return null;
  const status=statuses[String(input.booking.status)];if(!status)return null;
  const old=input.kind==='rescheduled'?time(input.oldTime):null;if(input.kind==='rescheduled'&&!old)return null;
  const snapshot=input.booking.journey_snapshot;
  const title=record(snapshot)?field(snapshot.title,180):'';
  const contactEmail=email(input.booking.client_email)||email(input.accountEmail);
  const lines=[titles[input.kind],'',`👤 Клиент: ${field(input.booking.client_name,100)||'Не указан'}`,`🩺 Услуга: ${title||services[input.service]}`,''];
  if(old)lines.push(`📆 Было: ${date(old)}, ${clock(old)} (МСК)`,`📆 Стало: ${date(slot)}, ${clock(slot)} (МСК)`);
  else lines.push(`📆 Дата: ${date(slot)}`,`🕒 Время: ${clock(slot)} (МСК)`);
  lines.push('',`📞 Телефон: ${phone(input.booking.client_phone)||'Не указан'}`,`✉️ Email: ${contactEmail||'Не указан'}`,'',`🔖 Статус: ${status}`);
  // Do not infer payment amount/date from a price snapshot or booking updated_at.
  if(input.kind==='paid')lines.push('Информация об оплате сохранена в системе Body State.');
  lines.push('','🔗 Открыть запись:',`https://body-state.ru/admin/bookings?booking=${input.bookingId.toLowerCase()}`);
  const text=lines.join('\n');return text.length<=3500?{subject:titles[input.kind],html:'',text}:null;
}

export async function resolveAdminMaxBooking(client:Pick<PoolClient,'query'>,row:{event_type:string;event_key:string;revision:number;payload:Record<string,unknown>}):Promise<AdminBookingResult>{
  if(!record(row.payload)||!Object.hasOwn(titles,row.event_type)||typeof row.payload.service!=='string'
    ||!isJourneyService(row.payload.service)||typeof row.payload.bookingId!=='string'||!validBookingId(row.payload.bookingId)
    ||!Number.isSafeInteger(row.revision)||row.revision<0)return invalid();
  const service=row.payload.service,id=row.payload.bookingId.toLowerCase(),kind=row.event_type as AdminBookingEvent;
  const key=typeof row.event_key==='string'?row.event_key.toLowerCase():'';
  const normal=`v1:admin:${service}:${id}:${kind}:${kind==='paid'?'settled':row.revision}`;
  const paidPrefix=`v1:admin:paid:${service}:${id}:`,order=key.startsWith(paidPrefix)?key.slice(paidPrefix.length):'';
  if(key!==normal&&!(kind==='paid'&&(order==='legacy'||validBookingId(order))))return invalid();
  // Runtime allowlist + UUID validation must precede loadJourney's table interpolation.
  const booking=await loadJourney(service,id,client);
  if(!booking)return {rejected:'admin_booking_unavailable'};
  if(Number(booking.notification_revision)!==row.revision)return kind==='paid'?invalid():null;
  if(!Object.hasOwn(statuses,String(booking.status)))return invalid();
  if(kind==='cancelled'?booking.status!=='cancelled':kind!=='paid'&&!['pending','confirmed'].includes(String(booking.status)))return null;
  if(kind==='confirmed'&&booking.status!=='confirmed')return null;
  if(kind==='created'&&booking.status!=='pending')return null;
  if(kind==='paid'&&booking.payment_status!=='paid')return invalid();
  if(kind==='rescheduled'){
    const previous=time(row.payload.oldTime),next=time(row.payload.newTime),slot=time(booking.slot_time);
    if(!previous||!next||!slot||next.getTime()!==slot.getTime())return invalid();
    const event=(await client.query(`SELECT old_time,new_time FROM booking_events WHERE booking_id=$1 AND service_type=$2 AND event_type='rescheduled' ORDER BY id DESC LIMIT 1`,[id,service])).rows[0];
    if(!event||time(event.old_time)?.getTime()!==previous.getTime()||time(event.new_time)?.getTime()!==next.getTime())return invalid();
  }
  let accountEmail:unknown;
  if(!email(booking.client_email)&&typeof booking.account_user_id==='string'&&validBookingId(booking.account_user_id)){
    accountEmail=(await client.query('SELECT email FROM account_users WHERE id=$1 AND disabled_at IS NULL AND verified_at IS NOT NULL',[booking.account_user_id])).rows[0]?.email;
  }
  const message=formatAdminMaxBooking({kind,bookingId:id,service,booking,oldTime:row.payload.oldTime,accountEmail});
  return message?{message}:invalid();
}
