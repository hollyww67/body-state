'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import MaxNotificationBinding from '@/components/admin/MaxNotificationBinding';
import {AdminBadge,AdminButton,AdminCard,AdminEmptyState,AdminFeedback,AdminLoadingState,AdminPageHeader} from '@/components/admin/ui';
type Row={id:string;booking_id:string|null;event_type:string;channel:string;status:string;scheduled_at:string;attempts:number;next_attempt_at:string;last_error:string|null;accepted_at:string|null;delivered_at:string|null;retry_allowed:boolean};
const states:Record<string,string>={queued:'В очереди',processing:'Отправляется',retry:'Ожидает повторной попытки',accepted:'Принято провайдером',delivered:'Доставка подтверждена',failed:'Не отправлено',not_configured:'Канал не настроен',cancelled:'Отменено',uncertain:'Результат неизвестен — нужен разбор'};
const events:Record<string,string>={created:'Заявка',confirmed:'Подтверждение',rescheduled:'Перенос',cancelled:'Отмена',reminder:'Напоминание',reminder_24h:'Напоминание за 24 часа',reminder_2h:'Напоминание за 2 часа',paid:'Оплата подтверждена',reset_requested:'Восстановление доступа',password_changed:'Пароль изменён',delivery_alert:'Проверка отправок'};
const errors:Record<string,string>={channel_not_configured:'Настройте канал перед повтором',contact_missing:'Контакт отсутствует',provider_outcome_unknown:'Возможно принятие провайдером. Автоповтор отключён.',provider_rate_limited:'Лимит провайдера',provider_unavailable:'Провайдер временно недоступен',provider_rejected:'Сообщение отклонено',attempts_exhausted:'Попытки исчерпаны',worker_interrupted:'Отправка прервалась; нужен разбор'};
export default function NotificationJournal(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();const booking=new URLSearchParams(location.search).get('booking');setLoading(true);setError('');
  void fetch('/api/admin/notifications'+(booking?'?booking='+encodeURIComponent(booking):''),{signal:controller.signal,cache:'no-store'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setRows(data.notifications);})
   .catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Ошибка загрузки');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[attempt]);
 async function retry(id:string){
  if(busy)return;setBusy(id);setError('');
  try{const response=await fetch('/api/admin/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
   const data=await response.json();if(!response.ok)throw new Error(data.error);setAttempt(value=>value+1);
  }catch(error){setError(error instanceof Error?error.message:'Ошибка повтора');}finally{setBusy('');}
 }
 return <div className="space-y-4">
  <MaxNotificationBinding/>
  <AdminPageHeader title="Журнал уведомлений"><AdminButton variant="outline" onClick={()=>setAttempt(value=>value+1)} disabled={loading}>Обновить</AdminButton></AdminPageHeader>
  <p className="text-sm text-[var(--admin-muted)]">Принятие провайдером не означает доставку. Последние 200 сообщений. Контакты, тексты и ссылки восстановления скрыты. Неопределённые отправки требуют разбора.</p>
  {error&&<AdminFeedback tone="destructive">{error}</AdminFeedback>}
  {loading?<AdminLoadingState>Загружаем журнал…</AdminLoadingState>:rows.length?rows.map(row=><AdminCard key={row.id} className="space-y-3">
   <div className="flex flex-wrap justify-between gap-2"><strong>{events[row.event_type]||'Сервисное сообщение'} · {row.channel.toUpperCase()}</strong><AdminBadge tone={row.status==='delivered'?'success':['failed','uncertain'].includes(row.status)?'destructive':['accepted','processing'].includes(row.status)?'info':'neutral'}>{states[row.status]||row.status}</AdminBadge></div>
   <p className="text-sm">План: {date(row.scheduled_at)} · Попыток: {row.attempts}{row.status==='retry'?` · Следующая: ${date(row.next_attempt_at)}`:''}</p>
   {row.accepted_at&&<p className="text-sm">Принятие: {date(row.accepted_at)}</p>}{row.delivered_at&&<p className="text-sm">Доставка: {date(row.delivered_at)}</p>}
   {row.last_error&&<p className="text-sm">{errors[row.last_error]||'Ошибка обработки'}</p>}
   <div className="flex flex-wrap gap-3">
    {row.booking_id&&<Link className="admin-secondary-action" href={'/admin/bookings?booking='+row.booking_id}>Карточка записи</Link>}
    {row.retry_allowed&&<AdminButton disabled={!!busy} onClick={()=>void retry(row.id)}>{busy===row.id?'Сохраняем…':'Поставить в очередь повторно'}</AdminButton>}
   </div>
  </AdminCard>):!error&&<AdminEmptyState title="Уведомлений пока нет" />}
 </div>;
}
function date(value:string){return new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'});}
