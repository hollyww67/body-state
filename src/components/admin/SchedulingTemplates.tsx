'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import type {Hours,WeekDay} from '@/lib/schedule-plan';
import ScheduleBreakEditor from './ScheduleBreakEditor';
import AdminConfirmDialog from './AdminConfirmDialog';
import {formatMoscow} from '@/lib/moscow-time';
type Template={id:string;name:string;version:number;active:boolean;week:WeekDay[];horizon_days:number};
type Preview={token:string;counts:Record<string,number>;days?:{day:string;conflicts:number}[]};
const weekdays=[{i:1,n:'Понедельник'},{i:2,n:'Вторник'},{i:3,n:'Среда'},{i:4,n:'Четверг'},{i:5,n:'Пятница'},{i:6,n:'Суббота'},{i:0,n:'Воскресенье'}];
const input='mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900';
export default function SchedulingTemplates({from,to,dates,hours,onChanged}:{from:string;to:string;dates:string[];hours:Hours;onChanged:()=>void}) {
  const [templates,setTemplates]=useState<Template[]>([]),[selected,setSelected]=useState('');
  const [name,setName]=useState(''),[week,setWeek]=useState<WeekDay[]>(()=>Array(7).fill(null)),[horizon,setHorizon]=useState(30),[active,setActive]=useState(false);
  const [version,setVersion]=useState<number|undefined>();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null),[lastRun,setLastRun]=useState<string>('');
  const [generation,setGeneration]=useState<{count:number;conflicts?:string[];horizon_end?:string}|null>(null);
  const pending=useRef(false),key=useRef('');
  const [previewInput,setPreviewInput]=useState('');
  const [exceptions,setExceptions]=useState<Array<{day:string;mode:string;reason:string}>>([]);
  const [scheduleState,setScheduleState]=useState<{next_run_at:string;published_through:string|null}|null>(null);
  const [confirmation,setConfirmation]=useState<{body:Record<string,unknown>;message:string}|null>(null);
  const loadController=useRef<AbortController|null>(null),loadSequence=useRef(0);
  const load=useCallback(async()=>{
    loadController.current?.abort();const abort=new AbortController();loadController.current=abort;const sequence=++loadSequence.current;
    const response=await fetch('/api/admin/scheduling',{cache:'no-store',signal:abort.signal}).catch(e=>{if(abort.signal.aborted)return null;throw e;});if(!response)return;const data=await response.json();
    if(abort.signal.aborted||sequence!==loadSequence.current)return;
    if(!response.ok)throw Error(data.error);setTemplates(data.templates);setExceptions(data.exceptions);setScheduleState(data.generation);setLastRun(data.runs[0]?`${formatMoscow(data.runs[0].created_at,'dd.MM.yyyy HH:mm')} МСК · новых окон: ${data.runs[0].result.count??0}`:'Продлений по V2 ещё нет');
  },[]);
  useEffect(()=>{const refresh=()=>load().catch(e=>{if(e.name!=='AbortError')setError(e.message);});void refresh();const timer=setInterval(refresh,30000);return()=>{clearInterval(timer);loadController.current?.abort();};},[load]);
  const run=async(body:Record<string,unknown>,done:(data:Record<string,unknown>)=>void)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try {const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error);done(data);}
    catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить операцию');}finally{pending.current=false;setBusy(false);}
  };
  const select=(id:string)=>{setSelected(id);setPreview(null);const t=templates.find(t=>t.id===id);setName(t?.name??'');setWeek(t?.week??Array(7).fill(null));setHorizon(t?.horizon_days??30);setActive(t?.active??false);setVersion(t?.version);};
  const signature=JSON.stringify({id:selected,version,from,to,name,week,horizon,active});
  const saved=templates.find(t=>t.id===selected);
  const unsaved=!!saved&&JSON.stringify({name,week,horizon_days:horizon,active})!==JSON.stringify({name:saved.name,week:saved.week,horizon_days:saved.horizon_days,active:saved.active});
  return <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-label="Недельные шаблоны и исключения">
    <h3 className="font-semibold text-gray-900">Рабочая неделя и исключения</h3>
    <p className="mt-1 text-xs text-gray-500">Один общий ресурс для всех услуг. Воскресный cron использует только выбранный активный шаблон; ручные исключения имеют приоритет.</p>
    {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <fieldset disabled={busy}><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs">Шаблон<select className={input} value={selected} onChange={e=>select(e.target.value)}><option value="">Создать новый</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}{t.active?' · активный':''}</option>)}</select></label>
      <label className="text-xs">Название<input className={input} value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
      <label className="text-xs">Горизонт публикации, дней<input className={input} type="number" min={7} max={180} value={horizon} onChange={e=>setHorizon(Number(e.target.value))}/></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Активный для воскресного продления</label>
    </div>
    <div className="mt-4 space-y-2">{weekdays.map(({i,n})=>{
      const h=week[i];
      const update=(patch:Partial<Hours>)=>setWeek(w=>w.map((d,index)=>index===i?{...(d??hours),...patch}:d));
      return <div key={i} className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[180px_1fr_1fr_100px]">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={h!==null} onChange={e=>setWeek(w=>w.map((d,index)=>index===i?(e.target.checked?{...hours,breaks:[...hours.breaks]}:null):d))}/>{n}{h===null?' · выходной':''}</label>
        {h&&<><label className="text-xs">Начало<input className={input} type="time" value={h.start} onChange={e=>update({start:e.target.value})}/></label><label className="text-xs">Конец<input className={input} type="time" value={h.end} onChange={e=>update({end:e.target.value})}/></label><label className="text-xs">Шаг, мин<input className={input} type="number" min={15} max={240} value={h.step} onChange={e=>update({step:Number(e.target.value)})}/></label><div className="sm:col-span-4"><fieldset className="flex flex-wrap gap-3"><legend className="text-xs">Направления · {n}</legend>{(['bfm','brt','psychology'] as const).map(s=><label key={s} className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={h.services.includes(s)} onChange={e=>update({services:e.target.checked?[...h.services,s]:h.services.filter(v=>v!==s)})}/>{s==='bfm'?'Физическая реабилитация':s==='brt'?'БРТ':'Психологическая реабилитация'}</label>)}</fieldset><ScheduleBreakEditor value={h.breaks} onChange={breaks=>update({breaks})} disabled={busy}/></div></>}
      </div>;
    })}</div></fieldset>
    <p className="mt-2 text-xs text-gray-500">Для включаемого дня берутся направления и перерывы из генератора выше. Сохранение шаблона само по себе не изменяет опубликованные слоты.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={busy||!name.trim()} className="min-h-11 rounded-xl bg-gray-900 px-4 text-sm text-white disabled:opacity-50" onClick={()=>run({action:'template',id:selected||undefined,version,name,week,horizon_days:horizon,active},data=>{const t=data.template as Template;setSelected(t.id);setVersion(t.version);void load().catch(e=>setError(e.message));toast.success('Шаблон сохранён');})}>Сохранить неделю</button>
      <button disabled={busy||!selected||unsaved} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50" onClick={()=>run({action:'template-preview',template_id:selected,from,to},data=>{setPreview(data as unknown as Preview);key.current=crypto.randomUUID();setPreviewInput(signature);})}>Предпросмотр на {from} — {to}</button>
      <button disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50" onClick={()=>run({action:'extend-preview'},data=>{setGeneration(data as typeof generation);void load().catch(e=>setError(e.message));})}>Проверить следующее продление</button>
    </div>
    {preview&&<div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm"><p>Новых окон: {preview.counts.created} · существующих: {preview.counts.existing} · защищённых: {preview.counts.protected} · конфликтов: {preview.counts.conflicts} · закрытых дней: {preview.counts.closed} · открываемых дней: {preview.counts.opened}</p><div className="mt-2 max-h-32 overflow-y-auto text-xs">{preview.days?.map(d=><p key={d.day}>{d.day}{d.conflicts?` · конфликтов: ${d.conflicts}`:''}</p>)}</div><button disabled={busy||previewInput!==signature||preview.counts.conflicts>0} className="mt-3 min-h-11 rounded-xl bg-violet-700 px-4 text-white disabled:opacity-50" onClick={()=>run({action:'template-apply',template_id:selected,from,to,token:preview.token,request_key:key.current},data=>{setPreview(null);onChanged();toast.success(`Создано новых окон: ${data.created}`);})}>Применить проверенный шаблон</button></div>}
    {unsaved&&<p role="status" className="mt-3 text-sm text-amber-800">Есть несохранённые изменения. Сначала сохраните неделю, затем повторите предпросмотр.</p>}
    <p className="mt-4 text-xs text-gray-500">Последнее продление: {lastRun}</p>
    {scheduleState&&<p className="mt-2 text-xs text-gray-500">Следующее воскресное продление по штатному cron: {formatMoscow(scheduleState.next_run_at,'dd.MM.yyyy HH:mm')} МСК. Свободные начала опубликованы до: {scheduleState.published_through?formatMoscow(scheduleState.published_through,'dd.MM.yyyy HH:mm'):'ещё не опубликованы'}. Сам статус запуска проверяется по журналу, дата не гарантирует успешное исполнение.</p>}
    {generation&&<p className="mt-2 text-sm">Dry-run: {generation.count} новых окон · горизонт до {generation.horizon_end??'по прежнему копированию недель'} · конфликтов: {generation.conflicts?.length??0}. Данные не изменены.</p>}
    <div className="mt-5 border-t pt-4">
      <h4 className="text-sm font-semibold">Исключения для выбранных дат ({dates.length})</h4>
      <p className="mt-1 text-xs text-gray-500">Выходной, отпуск или другие рабочие часы. При конфликте с записью вся операция будет отклонена. Ручные перерывы не снимаются.</p>
      <label className="mt-3 block text-xs">Причина<input className={input} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy||!dates.length} className="min-h-11 rounded-xl border border-violet-200 px-4 text-sm disabled:opacity-50" onClick={()=>setConfirmation({body:{action:'exception',dates:[...dates],mode:'closed',reason},message:'Закрыть выбранные дни для всех направлений. Действующие записи не будут отменены: при конфликте вся операция отклоняется.'})}>Закрыть выбранные дни</button>
        <button disabled={busy||!dates.length} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50" onClick={()=>setConfirmation({body:{action:'exception',dates:[...dates],mode:'hours',hours,reason},message:`Изменить рабочие часы на ${hours.start}–${hours.end}. Ручные перерывы и записи сохраняются.`})}>Временные часы из генератора</button>
        <button disabled={busy||!dates.length} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50" onClick={()=>setConfirmation({body:{action:'clear-exception',dates:[...dates]},message:'Снять исключения и восстановить активный недельный график. Другие перерывы не удаляются.'})}>Снять исключения</button>
      </div>
      <details className="mt-3 text-xs"><summary className="min-h-11 cursor-pointer">Сохранённые исключения ({exceptions.length})</summary>{exceptions.map(e=><p key={e.day} className="py-2">{e.day} · {e.mode==='closed'?'Закрыто':'Другие часы'} · {e.reason||'Без причины'}</p>)}</details>
    </div>
    {confirmation&&<AdminConfirmDialog title="Изменить расписание?" confirmLabel="Применить" pendingLabel="Применение…" onCancel={()=>setConfirmation(null)} onConfirm={async()=>{const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(confirmation.body)});const data=await response.json();if(!response.ok)throw Error(data.error);onChanged();await load();toast.success('Исключения сохранены');}}><p>{confirmation.message}</p><p className="mt-2 max-h-32 overflow-y-auto text-xs">Даты: {(confirmation.body.dates as string[]).join(', ')}</p></AdminConfirmDialog>}
  </section>;
}
