'use client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import { AdminPageHeader, AdminLoadingState, AdminBadge, AdminFeedback, AdminCard, AdminInput, AdminButton } from '@/components/admin/ui';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Copy, RefreshCw } from 'lucide-react';

type Room = { id: string; kind: 'booking'|'manual'; room_id: string; room_name: string; client_name: string; email: string; is_active: boolean; starts_at: string; expires_at: string };
export default function PsychologyRoomsAdmin() {
  const [closeTarget, setCloseTarget] = useState<Room | null>(null);
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
    setBusy(true);setError('');
    try{const res=await fetch('/api/psychology/rooms/'+id,{method:'DELETE'});if(!res.ok)throw new Error('Не удалось закрыть комнату');await load();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="bs-page">
      {closeTarget && <AdminConfirmDialog title="Закрыть комнату?" confirmLabel="Закрыть комнату" pendingLabel="Закрытие…" onCancel={() => setCloseTarget(null)} onConfirm={() => close(closeTarget.id)}><p>{closeTarget.room_name}</p><p>Участники будут отключены.</p></AdminConfirmDialog>}
    <AdminPageHeader title="Встречи со специалистом" description="Оплаченные онлайн-записи появляются здесь автоматически. Вход открывается за 15 минут до приёма и закрывается через 30 минут после его окончания. Время — московское."><Link className="bs-button bs-button--outline" href="/admin/bookings">Перейти к записям клиентов</Link></AdminPageHeader>
    <form onSubmit={create} className="bs-form">
      <h2 className="bs-section-heading">Отдельная комната на 24 часа</h2>
      <p className="mt-1 text-sm text-[var(--bs-muted)]">Для дополнительной встречи. Не создаёт приём и не засчитывает посещение. Клиент должен иметь аккаунт на сайте.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm">Название встречи<AdminInput required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full" placeholder="Дополнительная консультация"/></label>
        <label className="text-sm">Email аккаунта клиента<AdminInput required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full" placeholder="client@example.ru"/></label>
        <AdminButton variant="primary" type="submit" disabled={busy} className="self-end">{busy?'Сохранение…':'Создать комнату'}</AdminButton>
      </div>
    </form>
    {error&&<AdminFeedback tone="destructive">{error}</AdminFeedback>}
    {notice&&<AdminFeedback tone="success">{notice}</AdminFeedback>}
    <div className="flex items-center justify-between gap-3"><h2 className="bs-section-heading">Встречи</h2><AdminButton variant="outline" disabled={loading} onClick={()=>void load()} className="gap-2"><RefreshCw size={16}/>Обновить</AdminButton></div>
    {loading?<AdminLoadingState />:rooms.length===0&&!error?<p>Пока нет онлайн-встреч.</p>:null}
    <div className="grid gap-4">{rooms.map(room=>{
      const expired=!room.is_active||new Date(room.expires_at).getTime()<=Date.now();
      const early=room.kind==='booking'&&new Date(room.starts_at).getTime()-15*60000>Date.now();
      const url='/psychology/room?id='+room.room_id;
      return <AdminCard key={room.kind+room.id}>
        <h3 className="font-semibold">{room.room_name}</h3>
        <p className="mt-1 break-words">{room.client_name||'Клиент'} · {room.email}</p>
        <p className="mt-2 text-sm text-[var(--bs-muted)]">{room.kind==='booking'?'Приём':'Отдельная встреча'} · {new Date(room.starts_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} МСК</p>
        <AdminBadge className="mt-2" tone={expired ? "neutral" : early ? "warning" : "success"}>{expired?'Комната закрыта':early?'Вход откроется за 15 минут до приёма':'Можно подключиться'}</AdminBadge>
        <div className="mt-4 flex flex-wrap gap-3">
          {!expired&&!early&&<Link href={url} className="bs-button bs-button--primary"><Video size={18}/>Войти в комнату</Link>}
          {!expired&&<AdminButton variant="outline" className="gap-2" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+url);setNotice('Ссылка скопирована. Вход доступен только аккаунту этого клиента.');}catch{setError('Не удалось скопировать ссылку');}}}><Copy size={16}/>Ссылка клиенту</AdminButton>}
          {room.kind==='manual'&&!expired&&<AdminButton variant="destructive" disabled={busy} onClick={()=>setCloseTarget(room)}>Закрыть комнату</AdminButton>}
        </div>
      </AdminCard>;
    })}</div>
  </div>;
}
