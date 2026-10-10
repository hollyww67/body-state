'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Copy, RefreshCw } from 'lucide-react';

type Room = { id: string; kind: 'booking'|'manual'; room_id: string; room_name: string; client_name: string; email: string; is_active: boolean; starts_at: string; expires_at: string };
export default function PsychologyRoomsAdmin() {
  const [rooms,setRooms]=useState<Room[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const load=useCallback(async()=>{
    setLoading(true); setError('');
    try { const res=await fetch('/api/psychology/rooms'); const data=await res.json(); if(!res.ok) throw new Error(data.error); setRooms(data); }
    catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить комнаты');} finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function create(e:React.FormEvent) {
    e.preventDefault(); if(busy)return; setBusy(true); setError(''); setNotice('');
    try {
      const res=await fetch('/api/psychology/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room_name:name,email})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error);
      setName('');setEmail('');await load();setNotice('Комната создана и доступна в личном кабинете клиента.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось создать комнату');}finally{setBusy(false);}
  }
  async function close(id:string) {
    if(!confirm('Закрыть комнату? Участники будут отключены.'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/psychology/rooms/'+id,{method:'DELETE'});if(!res.ok)throw new Error('Не удалось закрыть комнату');await load();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <section className="rounded-2xl border p-5">
      <h2 className="text-xl font-semibold">Встречи со специалистом</h2>
      <p className="mt-2 text-sm text-slate-500">Оплаченные онлайн-записи появляются здесь автоматически. Вход открывается за 15 минут до приёма и закрывается через 30 минут после его окончания. Время — московское.</p>
      <Link className="mt-3 inline-flex underline" href="/admin/bookings">Перейти к записям клиентов</Link>
    </section>
    <form onSubmit={create} className="rounded-2xl border p-5">
      <h2 className="font-semibold">Отдельная комната на 24 часа</h2>
      <p className="mt-1 text-sm text-slate-500">Для дополнительной встречи. Не создаёт приём и не засчитывает посещение. Клиент должен иметь аккаунт на сайте.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">Название встречи<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border p-3" placeholder="Дополнительная консультация"/></label>
        <label className="text-sm">Email аккаунта клиента<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border p-3" placeholder="client@example.ru"/></label>
        <button disabled={busy} className="min-h-12 self-end rounded-xl bg-teal-600 px-4 py-3 text-white disabled:opacity-50">{busy?'Сохранение…':'Создать комнату'}</button>
      </div>
    </form>
    {error&&<p role="alert" className="rounded-xl border border-red-300 p-4 text-red-600">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border p-4">{notice}</p>}
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Встречи</h2><button disabled={loading} onClick={()=>void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4"><RefreshCw size={16}/>Обновить</button></div>
    {loading?<p role="status">Загрузка…</p>:rooms.length===0&&!error?<p>Пока нет онлайн-встреч.</p>:null}
    <div className="grid gap-4">{rooms.map(room=>{
      const expired=!room.is_active||new Date(room.expires_at).getTime()<=Date.now();
      const early=room.kind==='booking'&&new Date(room.starts_at).getTime()-15*60000>Date.now();
      const url='/psychology/room?id='+room.room_id;
      return <article key={room.kind+room.id} className="rounded-2xl border p-5">
        <h3 className="font-semibold">{room.room_name}</h3>
        <p className="mt-1 break-words">{room.client_name||'Клиент'} · {room.email}</p>
        <p className="mt-2 text-sm text-slate-500">{room.kind==='booking'?'Приём':'Отдельная встреча'} · {new Date(room.starts_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} МСК</p>
        <p className="mt-2 text-sm">{expired?'Комната закрыта':early?'Вход откроется за 15 минут до приёма':'Можно подключиться'}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!expired&&!early&&<Link href={url} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 text-white"><Video size={18}/>Войти в комнату</Link>}
          {!expired&&<button className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+url);setNotice('Ссылка скопирована. Вход доступен только аккаунту этого клиента.');}catch{setError('Не удалось скопировать ссылку');}}}><Copy size={16}/>Ссылка клиенту</button>}
          {room.kind==='manual'&&!expired&&<button disabled={busy} onClick={()=>void close(room.id)} className="min-h-11 rounded-xl border px-4 text-red-600">Закрыть комнату</button>}
        </div>
      </article>;
    })}</div>
  </div>;
}
