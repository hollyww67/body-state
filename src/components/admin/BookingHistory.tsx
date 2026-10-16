'use client';
import { AdminCard, AdminFeedback } from '@/components/admin/ui';
import {useEffect,useState} from 'react';
import {formatMoscow as format} from '@/lib/moscow-time';
type Event={id:number;event_type:string;old_time:string|null;new_time:string|null;old_status:string|null;new_status:string;old_duration:number|null;new_duration:number|null;actor:string;reason:string;created_at:string};
const names:Record<string,string>={created:'Создание',rescheduled:'Перенос',status_changed:'Изменение статуса',archived:'Архивирование',admin_action:'Действие администратора',payment_status_changed:'Изменение оплаты'};
export default function BookingHistory({id,revision}:{id:string;revision:string}) {
  const [events,setEvents]=useState<Event[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`/api/admin/bookings?id=${encodeURIComponent(id)}&archived=true`,{signal:abort.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);if(!abort.signal.aborted){setEvents(data.events??[]);setError('');}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[id,revision]);
  return <AdminCard className="sm:col-span-2" aria-label="История записи"><h3 className="text-sm font-semibold text-[var(--bs-foreground)]">История записи</h3>
    <p className="mt-1 text-xs text-[var(--bs-muted)]">Только события, зафиксированные после включения V2. Более ранняя история не восстанавливается предположениями.</p>
    {error?<AdminFeedback tone="destructive">История недоступна: {error}</AdminFeedback>:loading?<p role="status" className="mt-3 text-sm">Загружаем историю…</p>:!events.length?<p className="mt-3 text-sm text-[var(--bs-muted)]">Зафиксированных событий пока нет.</p>:<ol className="mt-3 space-y-3">{events.map(e=><li key={e.id} className="border-l-2 border-[var(--bs-border)] pl-3 text-xs text-[var(--bs-muted)]"><p className="font-semibold">{names[e.event_type]??e.event_type} · {format(e.created_at,'dd.MM.yyyy HH:mm')}</p>{e.event_type==='rescheduled'&&<p className="mt-1">{e.old_time?format(e.old_time,'dd.MM.yyyy HH:mm'):'—'} ({e.old_duration} мин) → {e.new_time?format(e.new_time,'dd.MM.yyyy HH:mm'):'—'} ({e.new_duration} мин) · Москва</p>}<p className="mt-1">{e.old_status?`${e.old_status} → `:''}{e.new_status} · {e.actor}{e.reason?` · ${e.reason}`:''}</p></li>)}</ol>}
  </AdminCard>;
}
