'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminFeedback, AdminSelect, AdminTextarea } from '@/components/admin/ui';
type Case={id:string;booking_id:string|null;order_id:string;reason:string;status:string;total:number;payment_status:string;result:string|null;comment:string|null;updated_by:string|null;updated_at:string};
type History={id:number;case_id:string;actor:string;status:string;result:string|null;comment:string;created_at:string};
const results:Record<string,string>={contacted_client:'Связались с клиентом',refund_handled_externally:'Возврат оформлен отдельно в банке',new_booking_agreed:'Согласована новая запись',no_action_required:'Действий не требуется'};
export default function PaymentCases(){const [rows,setRows]=useState<Case[]>([]),[history,setHistory]=useState<History[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState(''),[comment,setComment]=useState(''),[result,setResult]=useState('contacted_client'),[busy,setBusy]=useState(false);
 const initialLink=useRef(false);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');void fetch('/api/admin/payment-cases',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.cases);setHistory(d.history);if(!initialLink.current){initialLink.current=true;setSelected(new URLSearchParams(location.search).get('case')||'');}}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[attempt]);
 async function save(status:string){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/admin/payment-cases',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected,status,result,comment})});const d=await r.json();if(!r.ok)throw new Error(d.error);setComment('');setAttempt(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить разбор');}finally{setBusy(false);}}
 return <div className="space-y-4 text-[var(--bs-foreground)]">
  <h2 className="text-2xl font-semibold">Платежи на разбор</h2>
  <p className="text-sm text-[var(--bs-muted)]">Результат разбора сохраняется отдельно от банковского статуса. Возврат и новая бронь оформляются отдельными действиями. Администратор в проекте общий: автор изменений — «Общий администратор».</p>
  {error&&<AdminFeedback tone="destructive">{error}</AdminFeedback>}
  <AdminButton variant="secondary" onClick={()=>setAttempt(v=>v+1)} disabled={loading}>Обновить</AdminButton>
  {loading?<AdminFeedback>Загружаем случаи…</AdminFeedback>:rows.length?rows.map(c=><AdminCard className="space-y-3 p-5" key={c.id}>
   <div className="flex flex-wrap justify-between gap-3">
    <strong>{c.reason==='paid_cancelled_booking'?'Оплата отменённой записи':'Неизвестный результат создания платежа'}</strong>
    <span><AdminBadge tone={c.status==='open'?'warning':'success'}>{c.status==='open'?'Открыт':'Разобран'}</AdminBadge> · {Number(c.total).toLocaleString('ru-RU')} ₽</span>
   </div>
   <p className="break-all text-sm">Заказ {c.order_id} · статус банка в заказе: <AdminBadge>{c.payment_status}</AdminBadge></p>
   {c.comment&&<p className="whitespace-pre-wrap break-words">{c.comment}</p>}
   <p className="text-xs text-[var(--bs-muted)]">Изменено {new Date(c.updated_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}{c.updated_by?' · Общий администратор':''}</p>
   <div className="flex flex-wrap gap-3">
    <Link className="bs-button bs-button--secondary bs-button--md" href="/admin/orders">Заказы</Link>
    {c.booking_id&&<Link className="bs-button bs-button--secondary bs-button--md" href={'/admin/bookings?booking='+c.booking_id}>Карточка записи</Link>}
    <AdminButton onClick={()=>{setSelected(selected===c.id?'':c.id);setComment('');}}>Разобрать случай</AdminButton>
   </div>
   {selected===c.id&&<div className="space-y-3 border-t border-[var(--bs-border)] pt-4">
    <label className="block text-sm">Результат<AdminSelect className="mt-1" value={result} onChange={e=>setResult(e.target.value)}>{Object.entries(results).map(([v,l])=><option key={v} value={v}>{l}</option>)}</AdminSelect></label>
    <label className="block text-sm">Комментарий без чувствительных данных<AdminTextarea className="mt-1" minLength={5} maxLength={1000} rows={3} value={comment} onChange={e=>setComment(e.target.value)}/></label>
    <div className="flex flex-wrap gap-3">
     <AdminButton disabled={busy||comment.trim().length<5} onClick={()=>void save('resolved')}>Зафиксировать разбор</AdminButton>
     <AdminButton variant="secondary" disabled={busy||comment.trim().length<5} onClick={()=>void save('open')}>Оставить открытым с комментарием</AdminButton>
    </div>
    <details><summary className="min-h-11 cursor-pointer rounded-[var(--bs-radius-control)] py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bs-primary)]">История изменений</summary>{history.filter(h=>h.case_id===c.id).map(h=><p key={h.id} className="mt-2 break-words text-sm">{new Date(h.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} · Общий администратор · {h.status==='open'?'Открыт':'Разобран'} · {h.result?results[h.result]:''} · {h.comment}</p>)}</details>
   </div>}
  </AdminCard>):!error&&<AdminEmptyState title="Случаев для разбора нет."/>}
 </div>;
}
