'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import type {BookingJourney} from '@/lib/booking-journey';
import BookingCalendar from '@/components/BookingCalendar';
import {trackFunnel} from '@/lib/funnel-analytics';
import { CheckCircle2, Clock3 } from 'lucide-react';

export default function BookingReceipt({initial,accessToken=''}:{initial:BookingJourney;accessToken?:string}){
  const [booking,setBooking]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[transfer,setTransfer]=useState(false),[cancelConfirm,setCancelConfirm]=useState(false),[now,setNow]=useState(Date.now());
  const endpoint=`/api/booking/${booking.service}/${booking.id}`;
  const auth:Record<string,string>=accessToken?{Authorization:`Bearer ${accessToken}`} : {};
  const refresh=useCallback(async()=>{const r=await fetch(`/api/booking/${initial.service}/${initial.id}`,{headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{},cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Не удалось проверить запись');setBooking(data.booking);},[initial.service,initial.id,accessToken]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);
  useEffect(()=>{try{if(accessToken)sessionStorage.setItem(`booking-access:${initial.service}:${initial.id}`,accessToken);}catch{/* The current receipt remains available if browser storage is disabled. */}},[accessToken,initial.service,initial.id]);
  const snapshot=booking.snapshot,expired=!!booking.holdExpiresAt&&new Date(booking.holdExpiresAt).getTime()<=now&&booking.status==='pending';
  const closed=['cancelled','completed'].includes(booking.status);
  const status=booking.attendance==='absent'?'Отмечена неявка':booking.status==='cancelled'?'Запись отменена':booking.status==='completed'?(booking.attendance==='present'?'Приём состоялся':'Запись завершена'):booking.status==='confirmed'?'Запись подтверждена':expired?'Срок временной брони истёк':'Время временно забронировано';
  async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие');}finally{setBusy(false);}}
  async function mutate(actionName:string,slot_id?:string){const r=await fetch(endpoint,{method:'PATCH',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({action:actionName,slot_id})});const d=await r.json();if(!r.ok)throw new Error(d.error);setTransfer(false);setCancelConfirm(false);await refresh();}
  async function pay(){
    if(!snapshot)throw new Error('Стоимость старой записи не сохранена. Уточните её у администратора.');
    const r=await fetch('/api/payment/init',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:snapshot.total,promoCode:snapshot.promoCode,bookingAccessToken:accessToken,orderId:`${booking.service}-${booking.id}`,items:[{bookingType:booking.service,bookingId:booking.id,quantity:1}],consent:true})});
    const d=await r.json();if(!r.ok||!d.paymentUrl){await refresh().catch(()=>undefined);throw new Error(d.error||'Не удалось открыть оплату. Запись сохранена.');}
    trackFunnel('online_payment_started',booking.id);window.location.assign(d.paymentUrl);
  }
  async function calendar(){const r=await fetch(endpoint+'?format=ics',{headers:auth,cache:'no-store'});if(!r.ok)throw new Error('Не удалось получить календарь');const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='appointment.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="qp-receipt space-y-5 rounded-3xl border p-5 sm:p-7" style={{background:'var(--surface)',borderColor:'var(--glass-border)'}} aria-label="Результат записи">
    <div className="qp-receipt-heading">{booking.status==='confirmed'?<CheckCircle2 className="qp-receipt-icon" size={44} aria-hidden="true" />:booking.status==='pending'?<Clock3 className="qp-receipt-icon" size={44} aria-hidden="true" />:null}<h2 className="text-2xl font-semibold">{status}</h2><p className="mt-2 text-sm">Запись сохранена. Уведомление не влияет на её доступность здесь.</p></div>
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Detail name="Услуга" value={snapshot?.title||'Название не сохранено в этой записи'}/>
      <Detail name="Дата и время" value={new Date(booking.slotTime).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'short'})+' · Москва'}/>
      <Detail name="Длительность" value={snapshot?.duration?`${snapshot.duration} минут`:'Не указана'}/>
      <Detail name="Место" value={snapshot?.format==='online'?'Онлайн':snapshot?.address||'Адрес не указан. Уточните его у администратора.'}/>
      <Detail name="Итоговая стоимость" value={snapshot?`${snapshot.total.toLocaleString('ru-RU')} ₽${snapshot.discount?` · скидка ${snapshot.discount.toLocaleString('ru-RU')} ₽`:''}`:'Стоимость не сохранена для этой старой записи'}/>
      <Detail name="Оплата" value={booking.paymentStatus==='paid'?'Оплата подтверждена':booking.paymentOption==='at_appointment'?'На приёме · ожидается оплата':booking.paymentChecking?'Онлайн · оплата проверяется':'Онлайн · оплата ещё не подтверждена'}/>
    </dl>
    {booking.status==='pending'&&<p className="text-sm">{booking.holdExpiresAt?`Временная бронь действует до ${new Date(booking.holdExpiresAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} по Москве.`:'Срок временной брони для этой старой записи не сохранён.'} {expired?'Проверьте статус перед дальнейшими действиями.':'Завершите оплату до этого времени.'}</p>}
    <p>{closed?'Посмотреть историю можно в личном кабинете.':booking.status==='confirmed'?snapshot?.format==='online'?'Откройте личный кабинет перед встречей, чтобы перейти в комнату.':'Следующий шаг — прийти к указанному времени.': 'Следующий шаг — оплатить существующую запись или проверить состояние платежа.'}</p>
    <p className="text-sm text-[var(--foreground-secondary)]">{snapshot?.preparation||'Рекомендации по подготовке не указаны. При необходимости уточните их у администратора.'}</p>
    {error&&<p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {!closed&&!expired&&booking.status==='pending'&&booking.paymentOption==='online'&&<button className="ds-primary-button min-h-12" disabled={busy} onClick={()=>void action(pay)}>Продолжить оплату</button>}
      <button className="ds-secondary-button min-h-12" disabled={busy} onClick={()=>void action(refresh)}>Проверить состояние</button>
      {booking.status==='confirmed'&&snapshot&&<button className="ds-secondary-button min-h-12" disabled={busy} onClick={()=>void action(calendar)}>Добавить в календарь</button>}
      <Link className="ds-secondary-button min-h-12" href="/account">Личный кабинет</Link>
      <Link className="ds-secondary-button min-h-12 break-all" href={`/booking/${booking.service}/${booking.id}${accessToken?'#'+accessToken:''}`}>Открыть управление записью</Link>
    </div>
    {!closed&&<div className="flex flex-wrap gap-3"><button className="ds-secondary-button min-h-12" disabled={busy} onClick={()=>{setTransfer(!transfer);setCancelConfirm(false);}}>Перенести</button><button className="ds-secondary-button min-h-12" disabled={busy} onClick={()=>{setCancelConfirm(true);setTransfer(false);}}>Отменить запись</button></div>}
    {cancelConfirm&&<div className="space-y-3"><p>Отменить запись? Если она оплачена, возврат нужно отдельно обсудить с администратором.</p><button className="ds-secondary-button min-h-12" disabled={busy} onClick={()=>void action(()=>mutate('cancel'))}>Да, отменить</button><button className="ds-secondary-button min-h-12 ml-2" onClick={()=>setCancelConfirm(false)}>Оставить запись</button></div>}
    {transfer&&<BookingCalendar serviceType={booking.service} onSelect={slot=>void action(()=>mutate('reschedule',slot))}/>}
    {busy&&<p role="status">Выполняем действие…</p>}
  </section>;
}
function Detail({name,value}:{name:string;value:string}){return <div className="min-w-0"><dt className="text-xs text-[var(--foreground-secondary)]">{name}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>;}
