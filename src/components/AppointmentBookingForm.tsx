'use client';
import {useEffect,useRef,useState} from 'react';
import BookingCalendar,{type BookingCalendarSlot} from '@/components/BookingCalendar';
import PersonalDataConsent from '@/components/legal/PersonalDataConsent';
import PaymentOptionChoice,{type PaymentOption} from '@/components/PaymentOptionChoice';
import PromoCodeField,{type AppliedPromo} from '@/components/PromoCodeField';
import BookingReceipt from '@/components/BookingReceipt';
import {formatRussianPhoneInput} from '@/lib/phone';
import {useAccountPrefill} from '@/lib/hooks/use-account-prefill';
import type {BookingJourney,JourneyService} from '@/lib/booking-journey';
import {trackFunnel} from '@/lib/funnel-analytics';
export default function AppointmentBookingForm({service,price,programId}:{service:JourneyService;price:number;programId?:number}){
  const profile=useAccountPrefill();
  const [slot,setSlot]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[consent,setConsent]=useState(false),[option,setOption]=useState<PaymentOption>('online'),[format,setFormat]=useState<'online'|'offline'>('offline'),[promo,setPromo]=useState<AppliedPromo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<{summary:BookingJourney;accessToken:string}|null>(null);
  const lock=useRef(false),attempt=useRef<{key:string;token:string}|null>(null);
  const [selectedSlot,setSelectedSlot]=useState<BookingCalendarSlot|null>(null);
  useEffect(()=>{if(profile){setName(v=>v||profile.display_name||'');setPhone(v=>v||(profile.phone?formatRussianPhoneInput(profile.phone):''));setEmail(v=>v||profile.email||'');}},[profile]);
  async function submit(e:React.FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
    if(!attempt.current){const bytes=crypto.getRandomValues(new Uint8Array(32));attempt.current={key:crypto.randomUUID(),token:btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')};}
    try{const r=await fetch(`/api/book/${service}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot_id:slot,client_name:name,client_phone:phone,client_email:email,consent,payment_option:option,booking_type:format,program_id:programId,promoCode:promo?.code,requestKey:attempt.current.key,accessToken:attempt.current.token})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Не удалось записаться');setSaved(d.booking);trackFunnel('booking_created',d.booking.id);}catch(e){setError(e instanceof Error?e.message:'Связь прервалась. Повторите запрос: сохранённая запись не будет продублирована.');}finally{setBusy(false);lock.current=false;}}
  if(saved)return <BookingReceipt initial={saved.summary} accessToken={saved.accessToken}/>;
  if(!slot)return <BookingCalendar serviceType={service} onSelect={(id,details)=>{setSlot(id);setSelectedSlot(details);attempt.current=null;trackFunnel('service_selected',`form:${service}:${programId||''}`);trackFunnel('slot_selected',id);}}/>;
  const field='h-12 w-full min-w-0 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-base text-[var(--foreground)]';
  return <form onSubmit={submit} className="space-y-4">
    {selectedSlot&&<div className="rounded-2xl border border-[var(--input-border)] bg-[var(--primary-muted)] p-4" aria-label="Выбранный приём"><p className="font-semibold">{service==='bfm'?'Физическая реабилитация':service==='psychology'?'Психологическая реабилитация':'БРТ'}</p><p className="mt-1 text-sm">{new Date(selectedSlot.slot_time).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'short'})} · Москва</p><p className="mt-1 text-sm">Длительность: {selectedSlot.duration_minutes} минут</p></div>}
    <button type="button" className="ds-secondary-button min-h-11" disabled={busy} onClick={()=>{setSlot('');attempt.current=null;}}>← Выбрать другое время</button>
    {service==='psychology'&&<label className="block text-sm">Формат<select className={field+' mt-1'} value={format} disabled={busy} onChange={e=>{const value=e.target.value as 'online'|'offline';setFormat(value);if(value==='online')setOption('online');}}><option value="offline">Очно</option><option value="online">Онлайн</option></select></label>}
    <label className="block text-sm">Имя<input className={field+' mt-1'} required autoComplete="name" value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
    <label className="block text-sm">Телефон<input className={field+' mt-1'} required type="tel" autoComplete="tel" value={phone} disabled={busy} onChange={e=>setPhone(formatRussianPhoneInput(e.target.value))}/></label>
    <label className="block text-sm">Email для чека<input className={field+' mt-1'} required type="email" autoComplete="email" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
    <fieldset disabled={busy}><PaymentOptionChoice value={option} onChange={v=>{setOption(v);if(v==='at_appointment')setPromo(null);}} onlineOnly={format==='online'&&service==='psychology'}/>
    {option==='online'&&service!=='brt'&&<PromoCodeField serviceCode={programId?'psychology_program':service} onChange={setPromo}/>}</fieldset>
    <PersonalDataConsent id={`journey-${service}-${programId||''}`} checked={consent} onChange={setConsent}/>
    <p className="text-sm">{option==='online'?'Сначала сохраним запись и временно закрепим время. Затем вы сможете перейти к оплате.':'Запись подтвердится сразу. Оплата — на приёме.'}</p>
    {error&&<p role="alert" className="text-red-500">{error}</p>}
    <button className="liquid-btn min-h-12 w-full rounded-full px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy||!consent||price<=0}>{busy?'Сохраняем запись…':`Записаться · ${(promo?.total??price).toLocaleString('ru-RU')} ₽`}</button>
  </form>;
}
