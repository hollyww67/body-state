'use client';
import { AdminInput, AdminButton, AdminCard, AdminFeedback } from '@/components/admin/ui';
import {useEffect,useState} from 'react';
export type SchedulingClient={id:string;display_name:string|null;phone:string|null;email:string|null};
export default function SchedulingClientPicker({onSelect}:{onSelect:(client:SchedulingClient|null)=>void}) {
  const [search,setSearch]=useState(''),[clients,setClients]=useState<SchedulingClient[]>([]),[selected,setSelected]=useState<SchedulingClient|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{
    if(search.trim().length<3){setClients([]);return;}
    const abort=new AbortController();const timer=setTimeout(()=>{
      setLoading(true);fetch(`/api/admin/scheduling/clients?q=${encodeURIComponent(search.trim())}`,{signal:abort.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(!abort.signal.aborted){setClients(data.clients);setError('');}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    },250);
    return()=>{clearTimeout(timer);abort.abort();};
  },[search]);
  return <AdminCard>
    <label className="block text-xs">Найти существующий личный кабинет<AdminInput value={search} onChange={e=>setSearch(e.target.value)} placeholder="Имя, email или телефон — от 3 символов" className="mt-1 min-h-11 w-full text-sm"/></label>
    {error&&<AdminFeedback tone="destructive">{error}</AdminFeedback>}{loading&&<p role="status" className="text-xs">Поиск…</p>}
    {clients.length>0&&<ul className="mt-2 max-h-40 overflow-y-auto">{clients.map(c=><li key={c.id}><AdminButton variant="ghost" type="button" onClick={()=>{setSelected(c);setClients([]);onSelect(c);}} className="w-full justify-start whitespace-normal break-all text-left text-xs">{c.display_name??'Без имени'} · {c.email??c.phone}</AdminButton></li>)}</ul>}
    {selected?<div className="mt-2 text-xs"><p>Выбран: {selected.display_name} · {selected.email??selected.phone}</p><AdminButton variant="ghost" type="button" className="min-h-11 underline" onClick={()=>{setSelected(null);onSelect(null);}}>Без привязки к кабинету</AdminButton></div>:<p className="mt-1 text-xs text-[var(--bs-muted)]">Новый клиент: заполните имя и телефон ниже. Привязка по совпадению телефона не выполняется автоматически.</p>}
  </AdminCard>;
}
