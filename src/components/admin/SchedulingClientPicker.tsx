'use client';
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
  return <section className="rounded-xl border border-gray-200 p-3">
    <label className="block text-xs">Найти существующий личный кабинет<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Имя, email или телефон — от 3 символов" className="mt-1 min-h-11 w-full rounded-xl border px-3 text-sm"/></label>
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}{loading&&<p role="status" className="text-xs">Поиск…</p>}
    {clients.length>0&&<ul className="mt-2 max-h-40 overflow-y-auto">{clients.map(c=><li key={c.id}><button type="button" onClick={()=>{setSelected(c);setClients([]);onSelect(c);}} className="min-h-11 w-full rounded-lg p-2 text-left text-xs hover:bg-gray-50">{c.display_name??'Без имени'} · {c.email??c.phone}</button></li>)}</ul>}
    {selected?<div className="mt-2 text-xs"><p>Выбран: {selected.display_name} · {selected.email??selected.phone}</p><button type="button" className="min-h-11 underline" onClick={()=>{setSelected(null);onSelect(null);}}>Без привязки к кабинету</button></div>:<p className="mt-1 text-xs text-gray-500">Новый клиент: заполните имя и телефон ниже. Привязка по совпадению телефона не выполняется автоматически.</p>}
  </section>;
}
