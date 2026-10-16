'use client';
import Link from 'next/link';
import {formatMoscow as format,moscowInputToISO,sameMoscowDay} from '@/lib/moscow-time';
import type {Booking} from '@/lib/api/bookings';
import {ru} from 'date-fns/locale';

export type CalendarSlot={id:string;service_type:string;slot_time:string;duration_minutes:number;is_booked:boolean};
export type CalendarBreak={id:string;starts_at:string;ends_at:string;reason:string;source_type?:string};
export type CalendarDay={day:string;mode:'published'|'closed'|'unpublished';hours?:{start:string;end:string}|null};
const names:Record<string,string>={bfm:'Физическая реабилитация',brt:'БРТ',psychology:'Психологическая реабилитация'};
const minute=(date:string)=>Number(format(date,'HH'))*60+Number(format(date,'mm'));
export default function ScheduleTimeline({days,slots,bookings,breaks,rules,onSlot,onBreak}:{days:Date[];slots:CalendarSlot[];bookings:Booking[];breaks:CalendarBreak[];rules:CalendarDay[];onSlot:(s:CalendarSlot)=>void;onBreak:(b:CalendarBreak)=>void}) {
  // Derived from actual intervals/rules, including appointments crossing midnight.
  const allStarts=slots.map(s=>minute(s.slot_time));
  const allEnds=slots.map(s=>minute(s.slot_time)+s.duration_minutes);
  for(const day of days) {
    const start=Date.parse(moscowInputToISO(format(day,'yyyy-MM-dd'),'00:00')),end=start+86400000;
    for(const b of bookings) if(b.slot_time&&!['cancelled','completed'].includes(b.status)) {
      const a=Date.parse(b.slot_time),z=a+(b.duration_minutes??90)*60000;
      if(a<end&&z>start){allStarts.push(Math.max(0,(a-start)/60000));allEnds.push(Math.min(1440,(z-start)/60000));}
    }
    for(const b of breaks){const a=Date.parse(b.starts_at),z=Date.parse(b.ends_at);if(a<end&&z>start&&b.source_type!=='template'&&b.source_type!=='exception'){allStarts.push(Math.max(0,(a-start)/60000));allEnds.push(Math.min(1440,(z-start)/60000));}}
  }
  for(const day of days) {
    const h=rules.find(r=>r.day===format(day,'yyyy-MM-dd'))?.hours;
    if(h) {const n=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));allStarts.push(n(h.start));allEnds.push(n(h.end));}
  }
  const low=allStarts.length?Math.floor(Math.min(...allStarts)/60)*60:0;
  const high=allEnds.length?Math.min(1440,Math.ceil(Math.max(...allEnds)/60)*60):1440;
  const starts=[...new Set(slots.map(s=>minute(s.slot_time)))].sort((a,b)=>a-b);
  const minimumStep=starts.slice(1).reduce((n,m,i)=>Math.min(n,m-starts[i]),30);
  const scale=Math.max(1.4,44/minimumStep),height=(high-low)*scale;
  const label=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  return <div className="bs-timeline" aria-label="Временная сетка расписания">
    <div style={{minWidth:days.length>1?days.length*128+55:260}}>
      <div className="bs-timeline-heading grid sticky top-0 z-10 border-b border-[var(--bs-border)]" style={{gridTemplateColumns:`55px repeat(${days.length},minmax(0,1fr))`}}><span className="p-2 text-xs">МСК</span>{days.map(d=><div key={format(d,'yyyy-MM-dd')} className="p-2 text-center text-sm font-semibold">{format(d,'dd.MM EEE',{locale:ru})}</div>)}</div>
      <div className="grid" style={{gridTemplateColumns:`55px repeat(${days.length},minmax(0,1fr))`}}>
        <div className="relative text-xs text-[var(--bs-muted)]" style={{height}}>{Array.from({length:Math.ceil((high-low)/60)},(_,i)=>low+i*60).map(m=><span key={m} className="absolute px-1" style={{top:(m-low)*scale}}>{label(m)}</span>)}</div>
        {days.map(day=>{
          const key=format(day,'yyyy-MM-dd'),start=new Date(moscowInputToISO(key,'00:00')).getTime(),end=start+86400000;
          const daySlots=slots.filter(s=>sameMoscowDay(s.slot_time,day));
          const dayBookings=bookings.filter(b=>b.slot_time&&!['cancelled','completed'].includes(b.status)&&Date.parse(b.slot_time)<end&&Date.parse(b.slot_time)+(b.duration_minutes??90)*60000>start);
          const dayBreaks=breaks.filter(b=>Date.parse(b.starts_at)<start+high*60000&&Date.parse(b.ends_at)>start+low*60000);
          const rule=rules.find(r=>r.day===key);
          const box=(a:number,z:number)=>({top:Math.max(0,(Math.max(0,(a-start)/60000)-low)*scale),height:Math.max(24,(Math.min(high,(z-start)/60000)-Math.max(low,(a-start)/60000))*scale)});
          const empty=!daySlots.length&&!dayBookings.length&&!dayBreaks.length;
          return <div key={key} className="relative border-l border-[var(--bs-border)] bg-[var(--bs-surface-muted)]/30" style={{height}}>
            {Array.from({length:Math.ceil((high-low)/30)},(_,i)=><div key={i} className="absolute w-full border-t border-[var(--bs-border)]" style={{top:i*30*scale}}/>)}
            {rule?.mode==='closed'&&<div className="absolute inset-0 bg-[var(--bs-surface-muted)]/70 text-[var(--bs-muted)]"><p className="p-3 text-xs">Закрыто</p></div>}
            {empty&&<p className="p-3 text-xs text-[var(--bs-muted)]">{rule?.mode==='closed'?'Закрытый день':'Время не опубликовано'}</p>}
            {dayBreaks.map(b=><button key={b.id} onClick={()=>onBreak(b)} className="bs-calendar-break absolute left-1 right-1 overflow-hidden text-left px-2 text-xs" style={box(Date.parse(b.starts_at),Date.parse(b.ends_at))}>{b.reason||'Перерыв'} · {format(b.starts_at,'HH:mm')}–{format(b.ends_at,'HH:mm')}</button>)}
            {dayBookings.map(b=>{
              const a=Date.parse(b.slot_time!),z=a+(b.duration_minutes??90)*60000;
              const conflict=dayBookings.some(other=>other.id!==b.id&&Date.parse(other.slot_time!)<z&&Date.parse(other.slot_time!)+(other.duration_minutes??90)*60000>a)||dayBreaks.some(p=>Date.parse(p.starts_at)<z&&Date.parse(p.ends_at)>a);
              return <Link key={b.id} href={`/admin/bookings?booking=${encodeURIComponent(b.id)}`} className={`bs-calendar-event absolute left-1 right-1 overflow-hidden p-2 text-xs ${conflict?'is-conflict':''}`} style={box(a,z)}><strong>{format(b.slot_time!,'HH:mm')} · {b.client_name}</strong><br/>{names[b.service_type]}<br/>{b.duration_minutes} мин · {conflict?'Конфликт':b.status==='pending'?'Ожидает оплаты':'Подтверждена'}</Link>;
            })}
            {daySlots.filter(s=>!s.is_booked).map(s=>{
              const same=daySlots.filter(a=>!a.is_booked&&a.slot_time===s.slot_time),column=same.findIndex(a=>a.id===s.id);
              return <button key={s.id} onClick={()=>onSlot(s)} title={`${names[s.service_type]} · ${s.duration_minutes} мин`} className="bs-time-slot absolute min-h-10 overflow-hidden px-1 text-xs hover:bg-[var(--bs-primary-soft)] focus:ring-2 focus:ring-[var(--bs-primary)]" style={{top:(minute(s.slot_time)-low)*scale,left:`${column*100/same.length}%`,width:`${100/same.length}%`,zIndex:2}}>{format(s.slot_time,'HH:mm')} {s.service_type==='bfm'?'Физ.':s.service_type==='brt'?'БРТ':'Псих.'}</button>;
            })}
          </div>;
        })}
      </div>
    </div>
    <p className="border-t border-[var(--bs-border)] p-3 text-xs text-[var(--bs-muted)]">Свободные начала — альтернативы. Пересекающиеся услуги нельзя записать одновременно. Высота занятого интервала соответствует длительности.</p>
  </div>;
}
