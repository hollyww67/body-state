"use client";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import { AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminEmptyState, AdminFeedback, AdminInput, AdminSelect, AdminSkeleton, AdminStatCard } from '@/components/admin/ui';

import { useCallback,useEffect,useRef,useState, useMemo } from "react";
import SchedulingTemplates from '@/components/admin/SchedulingTemplates';
import ScheduleBreakEditor from '@/components/admin/ScheduleBreakEditor';
import ScheduleTimeline,{type CalendarSlot,type CalendarDay} from '@/components/admin/ScheduleTimeline';
import type {Booking} from '@/lib/api/bookings';
import {useRouter} from 'next/navigation';
import { parseISO, addDays } from "date-fns";
import { formatMoscow as format, moscowDate, moscowInputToISO } from "@/lib/moscow-time";
import { ru } from "date-fns/locale";
import { Plus, Trash2, RefreshCw, Calendar, Eye, Layers, Coffee, Clock3 } from "lucide-react";
import { toast } from "sonner";

interface Slot {
  id: string;
  service_type: string;
  slot_time: string;
  is_booked: boolean;
  is_break?: boolean;
  is_closed?:boolean;
  duration_minutes:number;
}

interface ScheduleBreak {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  source_type?:string;
}

const SERVICE_TYPES = [
  { value: "bfm", label: "Физическая реабилитация", color: "border-l-amber-400 bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  { value: "brt", label: "БРТ", color: "border-l-emerald-400 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  { value: "psychology", label: "Психологическая реабилитация", color: "border-l-sky-400 bg-sky-50", badge: "bg-sky-100 text-sky-700" },
];

const PRESETS = [
  { label: "Реабилитация · 90 минут", from: "09:30", to: "18:30", step: 90 },
  { label: "Утро", from: "08:00", to: "12:00", step: 40 },
  { label: "Вечер", from: "16:00", to: "20:00", step: 60 },
];

const WEEKDAYS = [
  { value: 1, label: "Пн" }, { value: 2, label: "Вт" }, { value: 3, label: "Ср" },
  { value: 4, label: "Чт" }, { value: 5, label: "Пт" }, { value: 6, label: "Сб" }, { value: 0, label: "Вс" },
];

export default function AdminSlotsPage() {
  const router=useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [scheduleBreaks, setScheduleBreaks] = useState<ScheduleBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "timeline">("list");
  const [timelineBookings,setTimelineBookings]=useState<Booking[]>([]);
  const [timelineSlots,setTimelineSlots]=useState<CalendarSlot[]>([]),[timelineRules,setTimelineRules]=useState<CalendarDay[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"selected" | "all_free">("selected");
  const [filterFree, setFilterFree] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState("bfm");
  const [dateFrom, setDateFrom] = useState(() => format(addDays(moscowDate(), 1), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(addDays(moscowDate(), 30), "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("09:30");
  const [timeTo, setTimeTo] = useState("18:30");
  const [step, setStep] = useState(90);
  const [planBreaks,setPlanBreaks]=useState<Array<{start:string;end:string}>>([]);
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5, 6]));
  const [showPreview, setShowPreview] = useState(false);
  const [dateMode,setDateMode]=useState<'range'|'weekdays'|'dates'>('weekdays');
  const [customDates,setCustomDates]=useState<string[]>([]);
  const [pickDate,setPickDate]=useState('');
  const [copySource,setCopySource]=useState(''),[copyPreview,setCopyPreview]=useState<{token:string;counts:Record<string,number>;plan:Record<string,unknown>}|null>(null);
  const copyRequest=useRef('');
  const [copySignature,setCopySignature]=useState('');
  const [excludedDates,setExcludedDates]=useState<string[]>([]);
  const [operationPending,setOperationPending]=useState(false);
  const [serverPreview,setServerPreview]=useState<{token:string;counts:Record<string,number>;rows:{day:string;service:string;time:string;result:string}[]}|null>(null);
  const previewPlan=useRef<Record<string,unknown>|null>(null),requestKey=useRef('');
  const [previewSignature,setPreviewSignature]=useState(''),[previewAll,setPreviewAll]=useState(false);
  const [loadFrom,setLoadFrom]=useState(()=>format(moscowDate(),'yyyy-MM-dd'));
  const [loadTo,setLoadTo]=useState(()=>format(addDays(moscowDate(),30),'yyyy-MM-dd'));
  const [counts,setCounts]=useState({total:0,free:0,booked:0});
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const nextOffsetRef=useRef<number|null>(null);
  const [loadError,setLoadError]=useState('');
  const latest=useRef(0),abortRef=useRef<AbortController|null>(null),loaded=useRef('');
  const [breakDate, setBreakDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  const [breakReason, setBreakReason] = useState("");
  const [savingBreak, setSavingBreak] = useState(false);
  const [deletingBreakId, setDeletingBreakId] = useState<string | null>(null);

  const fetchSlots = useCallback(async (append=false) => {
    const seq=++latest.current;abortRef.current?.abort();const abort=new AbortController();abortRef.current=abort;
    if(!append&&loaded.current!==`${loadFrom}:${loadTo}:${filterType}:${filterFree}:${view}`)setLoading(true);
    try {
      const params=new URLSearchParams({from:loadFrom,to:loadTo,limit:'500',offset:String(append?nextOffsetRef.current??0:0)});
      if(filterType)params.set('service',filterType);if(filterFree!==null)params.set('availability',filterFree?'free':'booked');
      const [slotsResponse, breaksResponse] = await Promise.all([fetch(`/api/admin/slots/list?${params}`,{signal:abort.signal,cache:'no-store'}), fetch(`/api/admin/schedule-breaks?from=${loadFrom}&to=${loadTo}`,{signal:abort.signal,cache:'no-store'})]);
      const [data, breaksData] = await Promise.all([slotsResponse.json(), breaksResponse.json()]);
      if (!slotsResponse.ok) throw new Error(data.error || "Не удалось загрузить слоты");
      if (!breaksResponse.ok) throw new Error(breaksData.error || "Не удалось загрузить перерывы");
      if(seq!==latest.current)return;
      setSlots(previous=>append?[...previous,...data.slots.filter((s:Slot)=>!previous.some(p=>p.id===s.id))]:data.slots);
      setCounts(data.counts);setNextOffset(data.next_offset);nextOffsetRef.current=data.next_offset;
      setScheduleBreaks(breaksData.breaks || []);
      if(view==='timeline') {
        const chunks:Array<{from:string;to:string}>=[];
        for(let day=moscowDate(loadFrom),end=moscowDate(loadTo);day<=end;day=addDays(day,42))chunks.push({from:format(day,'yyyy-MM-dd'),to:format(addDays(day,41)<end?addDays(day,41):end,'yyyy-MM-dd')});
        const calendars=await Promise.all(chunks.map(async range=>{const response=await fetch(`/api/admin/calendar?from=${range.from}&to=${range.to}`,{signal:abort.signal,cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);return result as {slots:CalendarSlot[];bookings:Booking[];days:CalendarDay[]};}));
        if(seq===latest.current){
          const allSlots=calendars.flatMap(c=>c.slots),rules=new Map(calendars.flatMap(c=>c.days).map(d=>[d.day,d]));
          const days:CalendarDay[]=[];
          for(let d=moscowDate(loadFrom),end=moscowDate(loadTo);d<=end;d=addDays(d,1)){const day=format(d,'yyyy-MM-dd');days.push(rules.get(day)??{day,mode:allSlots.some(s=>format(s.slot_time,'yyyy-MM-dd')===day)?'published':'unpublished'});}
          setTimelineBookings([...new Map(calendars.flatMap(c=>c.bookings).map(b=>[b.id,b])).values()]);setTimelineSlots(allSlots);setTimelineRules(days);
        }
      }
      if(seq!==latest.current)return;
      setLoadError('');loaded.current=`${loadFrom}:${loadTo}:${filterType}:${filterFree}:${view}`;
      setSelected(previous=>new Set([...previous].filter(id=>append||data.slots.some((s:Slot)=>s.id===id))));
    } catch(error) {if(!abort.signal.aborted&&seq===latest.current){setLoadError(error instanceof Error?error.message:'Ошибка загрузки');toast.error('Ошибка загрузки');}} finally { if(seq===latest.current)setLoading(false); }
  },[loadFrom,loadTo,filterType,filterFree,view]);

  useEffect(() => {fetchSlots();return()=>abortRef.current?.abort();},[fetchSlots]);

  const futureSlots = useMemo(() =>
    slots.filter((s) => new Date(s.slot_time) > new Date()).sort((a, b) => new Date(a.slot_time).getTime() - new Date(b.slot_time).getTime()),
  [slots]);

  const filtered = useMemo(() => {
    let result = futureSlots;
    if (filterFree === true) result = result.filter((s) => !s.is_booked);
    if (filterFree === false) result = result.filter((s) => s.is_booked);
    if (filterType) result = result.filter((s) => s.service_type === filterType);
    return result;
  }, [futureSlots, filterFree, filterType]);

  const freeSlots = useMemo(() => filtered.filter((s) => !s.is_booked), [filtered]);
  const allFreeSlots = freeSlots;

  const makePlan=(all=false)=>({...(dateMode==='dates'?{dates:customDates}:{from:dateFrom,to:dateTo||dateFrom,...(dateMode==='weekdays'?{weekdays:[...weekdays]}:{})}),excludeDates:excludedDates,hours:{start:timeFrom,end:timeTo,step,services:all?SERVICE_TYPES.map(s=>s.value):[serviceType],breaks:planBreaks}});
  const selectedDates=useMemo(()=>{
    if(dateMode==='dates')return customDates.filter(d=>!excludedDates.includes(d));
    if(!dateFrom||!dateTo)return [];
    const result:string[]=[];let d=moscowDate(dateFrom);const end=moscowDate(dateTo);
    for(let n=0;n<366&&d<=end;n++,d=addDays(d,1)){const key=format(d,'yyyy-MM-dd');if(!excludedDates.includes(key)&&(dateMode!=='weekdays'||weekdays.has(d.getDay())))result.push(key);}
    return result;
  },[customDates,dateMode,dateFrom,dateTo,excludedDates,weekdays]);
  const previewMatches=previewSignature===JSON.stringify(makePlan(previewAll));
  const fetchPreview=async(all=false)=>{
    if(operationPending)return;setOperationPending(true);
    try {
      const plan=makePlan(all);const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...plan,action:'preview'})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      previewPlan.current=plan;setPreviewSignature(JSON.stringify(plan));setPreviewAll(all);requestKey.current=crypto.randomUUID();setServerPreview(data);setShowPreview(true);
    }catch(error){toast.error(error instanceof Error?error.message:'Предпросмотр недоступен');}finally{setOperationPending(false);}
  };

  const handleCreate = async () => {
    if(!serverPreview||!previewPlan.current||operationPending)return;
    setOperationPending(true);
    try {
      const res = await fetch("/api/admin/scheduling", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...previewPlan.current,action:'apply',token:serverPreview.token,request_key:requestKey.current}),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Создано новых окон: ${data.created}. Уже существовало: ${data.existing}`); fetchSlots(); setShowPreview(false);setServerPreview(null); }
      else {if(res.status===409)setServerPreview(null);toast.error(data.error || "Ошибка");}
    } catch { toast.error("Ошибка сети"); } finally {setOperationPending(false);}
  };

  const handleCreateAll = async () => {
    await fetchPreview(true);
  };
  const windowAction=async(closed:boolean)=>{
    if(operationPending||!selected.size)return;setOperationPending(true);
    try {const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:closed?'close-windows':'open-windows',ids:[...selected]})});const data=await response.json();if(!response.ok)throw Error(data.error);toast.success(`Изменено ограничений: ${data.changed}. Остальные перерывы и записи сохранены.`);await fetchSlots();}catch(e){toast.error(e instanceof Error?e.message:'Не удалось изменить окна');}finally{setOperationPending(false);}
  };
  const copyDay=async(apply=false)=>{
    if(apply&&copySignature!==JSON.stringify({copySource,selectedDates}))return toast.error('Даты изменились. Повторите предпросмотр копирования.');
    if(operationPending||!copySource)return;setOperationPending(true);
    try {const body=apply&&copyPreview?{...copyPreview.plan,action:'apply',token:copyPreview.token,request_key:copyRequest.current}:{action:'copy-preview',source_day:copySource,dates:selectedDates};
      const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error);
      if(apply){setCopyPreview(null);await fetchSlots();toast.success(`Создано новых окон: ${data.created}`);}else{setCopyPreview(data);setCopySignature(JSON.stringify({copySource,selectedDates}));copyRequest.current=crypto.randomUUID();}
    }catch(e){toast.error(e instanceof Error?e.message:'Не удалось скопировать день');}finally{setOperationPending(false);}
  };

  const deleteSelected = async () => {
    const ids = deleteMode === "all_free" ? allFreeSlots.map(s => s.id) : [...selected];
    if (ids.length === 0) return;
    const res = await fetch("/api/admin/slots/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Удалено слотов: ${data.count ?? 0}`);
        fetchSlots();
      } else {
        throw new Error(data.error || "Ошибка удаления");
      }
  };

  const createBreak = async () => {
    if (!breakDate || !breakFrom || !breakTo) return toast.error("Укажите дату и время перерыва");
    const startsAt = new Date(moscowInputToISO(breakDate, breakFrom));
    const endsAt = new Date(moscowInputToISO(breakDate, breakTo));
    if (endsAt <= startsAt) return toast.error("Окончание должно быть позже начала");
    setSavingBreak(true);
    try {
      const response = await fetch("/api/admin/schedule-breaks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: breakReason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать перерыв");
      toast.success("Перерыв добавлен. Запись на это время закрыта.");
      setBreakReason("");
      await fetchSlots();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка сети"); }
    finally { setSavingBreak(false); }
  };

  const removeBreak = async (id: string) => {
    setDeletingBreakId(id);
    try {
      const response = await fetch(`/api/admin/schedule-breaks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить перерыв");
      toast.success("Перерыв удалён. Свободные окна восстановлены.");
      await fetchSlots();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка сети"); }
    finally { setDeletingBreakId(null); }
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (selected.size === freeSlots.length) setSelected(new Set()); else setSelected(new Set(freeSlots.map((s) => s.id))); };
  const applyPreset = (p: typeof PRESETS[0]) => { setTimeFrom(p.from); setTimeTo(p.to); setStep(p.step); };
  const toggleWeekday = (value: number) => setWeekdays((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  const setNextMonth = () => { setDateFrom(format(addDays(moscowDate(), 1), "yyyy-MM-dd")); setDateTo(format(addDays(moscowDate(), 30), "yyyy-MM-dd")); };

  const stats = { total: counts.total, free: counts.free, booked:counts.booked, breaks: scheduleBreaks.filter(b=>!b.source_type||b.source_type==='manual').length };

  const grouped = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    filtered.forEach((s) => { const day = format(parseISO(s.slot_time), "d MMMM yyyy, EEEE", { locale: ru }); if (!groups[day]) groups[day] = []; groups[day].push(s); });
    return groups;
  }, [filtered]);

  return (
    <div className="admin-slots-page max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 bg-[var(--bs-background)] pb-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h2 className="text-xl font-semibold text-[var(--bs-foreground)]">Доступное время</h2><p className="mt-1 text-xs text-[var(--bs-muted)]">Московское время</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-[var(--bs-radius-control)] bg-[var(--bs-surface-muted)] p-1">
              <AdminButton type="button" size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView("list")}>Список</AdminButton>
              <AdminButton type="button" size="sm" variant={view === 'timeline' ? 'secondary' : 'ghost'} aria-pressed={view === 'timeline'} onClick={() => setView("timeline")}>По времени</AdminButton>
            </div>
            <AdminButton type="button" variant="ghost" size="icon" onClick={()=>fetchSlots()} aria-label="Обновить расписание"><RefreshCw className="w-4 h-4" /></AdminButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
          {[{ label: "Всего", value: stats.total }, { label: "Свободно", value: stats.free }, { label: "Недоступно", value: stats.booked }, { label: "Перерывы", value: stats.breaks }].map((s) => (
            <AdminStatCard key={s.label} title={s.label} value={s.value} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminButton type="button" size="sm" variant={filterFree === true ? 'secondary' : 'outline'} aria-pressed={filterFree === true} onClick={() => setFilterFree(filterFree === true ? null : true)}>Свободные</AdminButton>
          <AdminButton type="button" size="sm" variant={filterFree === false ? 'secondary' : 'outline'} aria-pressed={filterFree === false} onClick={() => setFilterFree(filterFree === false ? null : false)}>Недоступные</AdminButton>
          {SERVICE_TYPES.map((t) => (<AdminButton type="button" size="sm" key={t.value} variant={filterType === t.value ? 'secondary' : 'outline'} aria-pressed={filterType === t.value} onClick={() => setFilterType(filterType === t.value ? null : t.value)}>{t.label}</AdminButton>))}
          {selected.size > 0 && (
            <AdminButton type="button" size="sm" variant="destructive" onClick={() => { setDeleteMode("selected"); setShowConfirm(true); }}>
              <Trash2 className="w-3 h-3" /> Удалить выбранные ({selected.size})
            </AdminButton>
          )}
          {selected.size>0&&<><AdminButton type="button" variant="outline" size="sm" disabled={operationPending} onClick={()=>windowAction(true)}>Закрыть выбранное время</AdminButton><AdminButton type="button" variant="outline" size="sm" disabled={operationPending} onClick={()=>windowAction(false)}>Снять закрытие выбранных окон</AdminButton></>}
          {allFreeSlots.length > 0 && (
            <AdminButton type="button" variant="destructive" size="sm" onClick={() => { setDeleteMode("all_free"); setShowConfirm(true); }}>
              <Trash2 className="w-3 h-3" /> Удалить свободные на этой странице ({allFreeSlots.length})
            </AdminButton>
          )}
        </div>
      </div>
      <AdminCard className="mb-6 grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-xs">Показывать с<AdminInput type="date" value={loadFrom} onChange={e=>setLoadFrom(e.target.value)} className="mt-1"/></label>
        <label className="text-xs">Показывать по<AdminInput type="date" value={loadTo} onChange={e=>setLoadTo(e.target.value)} className="mt-1"/></label>
        <p className="text-xs text-[var(--bs-muted)] sm:col-span-2">Счётчики относятся к выбранным датам и фильтрам. Удаление — только для явно выбранных или показанных окон. Исторически связанные окна защищены.</p>
      </AdminCard>
      {loadError&&<AdminFeedback tone="destructive">{loadError} · Ранее загруженные данные могут быть устаревшими.</AdminFeedback>}

      <AdminCard className="mb-6 p-5">
        <div className="mb-4 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--bs-radius-card)] bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"><Coffee className="h-5 w-5" /></div><div><h3 className="font-semibold text-[var(--bs-foreground)]">Добавить перерыв</h3><p className="mt-1 text-xs leading-5 text-[var(--bs-muted)]">Перерыв закроет для записи все пересекающиеся окна во всех направлениях.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <label className="text-xs font-medium text-[var(--bs-muted)]">Дата<AdminInput type="date" value={breakDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setBreakDate(event.target.value)} className="mt-1" /></label>
          <label className="text-xs font-medium text-[var(--bs-muted)]">С<AdminInput type="time" value={breakFrom} onChange={(event) => setBreakFrom(event.target.value)} className="mt-1" /></label>
          <label className="text-xs font-medium text-[var(--bs-muted)]">До<AdminInput type="time" value={breakTo} onChange={(event) => setBreakTo(event.target.value)} className="mt-1" /></label>
          <label className="text-xs font-medium text-[var(--bs-muted)]">Причина<AdminInput value={breakReason} maxLength={200} onChange={(event) => setBreakReason(event.target.value)} placeholder="Например: стоматолог" className="mt-1" /></label>
          <AdminButton type="button" onClick={createBreak} disabled={savingBreak} className="mt-auto"><Plus className="h-4 w-4" />{savingBreak ? "Добавляем…" : "Добавить"}</AdminButton>
        </div>
        {scheduleBreaks.length > 0 && <details className="mt-5"><summary className="min-h-11 cursor-pointer text-sm">Перерывы и ограничения графика ({scheduleBreaks.length})</summary><div className="grid gap-2 md:grid-cols-2">{scheduleBreaks.map((item) => <AdminCard key={item.id} className="flex items-center gap-3 p-3"><Clock3 className="h-4 w-4 shrink-0 text-[var(--bs-primary)]" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--bs-foreground)]">{format(parseISO(item.starts_at), "d MMMM, HH:mm", { locale: ru })}–{format(parseISO(item.ends_at), "d MMMM, HH:mm",{locale:ru})}</p><p className="text-xs text-[var(--bs-muted)]">{item.reason || "Перерыв"} · {item.source_type==='template'?'Недельный график':item.source_type==='exception'?'Исключение дня':item.source_type==='window'?'Закрытое окно':'Ручной перерыв'}</p></div>{(!item.source_type||item.source_type==='manual')&&<AdminButton type="button" variant="destructive" size="icon" onClick={() => removeBreak(item.id)} disabled={deletingBreakId === item.id} aria-label={`Удалить перерыв ${item.reason}`}><Trash2 className="h-4 w-4" /></AdminButton>}</AdminCard>)}</div></details>}
      </AdminCard>

      <AdminCard className="p-5 mb-6">
        <h3 className="font-semibold text-[var(--bs-foreground)] mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Открыть время для записи</h3>
        <div className="mb-4 flex flex-wrap gap-2">{(['range','weekdays','dates'] as const).map(mode=><AdminButton type="button" key={mode} variant={dateMode===mode?'secondary':'outline'} onClick={()=>setDateMode(mode)} aria-pressed={dateMode===mode}>{mode==='range'?'Диапазон':mode==='weekdays'?'Дни недели':'Произвольные даты'}</AdminButton>)}</div>
        <div className="mb-4 flex flex-wrap gap-2"><label className="text-xs">Добавить или исключить дату<AdminInput type="date" value={pickDate} onChange={e=>setPickDate(e.target.value)} className="mt-1 block"/></label><AdminButton type="button" variant="outline" disabled={!pickDate} className="self-end" onClick={()=>{setCustomDates(d=>[...new Set([...d,pickDate])].sort());setExcludedDates(d=>d.filter(a=>a!==pickDate));setDateMode('dates');}}>Добавить дату</AdminButton><AdminButton type="button" variant="outline" disabled={!pickDate} className="self-end" onClick={()=>setExcludedDates(d=>[...new Set([...d,pickDate])].sort())}>Исключить дату</AdminButton></div>
        <div className="mb-4 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{selectedDates.map(d=><AdminButton type="button" variant="secondary" size="sm" key={d} aria-label={`Исключить ${d}`} onClick={()=>setExcludedDates(a=>[...a,d])}>{d} ×</AdminButton>)}{excludedDates.map(d=><AdminButton type="button" variant="destructive" size="sm" key={d} onClick={()=>setExcludedDates(a=>a.filter(v=>v!==d))}>{d} исключена · вернуть</AdminButton>)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <label className="grid gap-2 text-xs">Направление<AdminSelect value={serviceType} onChange={(e) => { const value = e.target.value; setServiceType(value); setStep(value === "brt" ? 60 : 90); }}>
            {SERVICE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </AdminSelect></label>
          <label className="grid gap-2 text-xs">С даты<AdminInput type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (!dateTo) setDateTo(e.target.value); }} /></label>
          <label className="grid gap-2 text-xs">По дату включительно<AdminInput type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} /></label>
          <label className="grid gap-2 text-xs">Начало рабочего дня<AdminInput type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} /></label>
          <label className="grid gap-2 text-xs">Конец рабочего дня<AdminInput type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} /></label>
          <label className="grid gap-2 text-xs">Интервал между началами<AdminSelect value={step} onChange={(e) => setStep(Number(e.target.value))}>
            <option value={30}>30 мин</option><option value={40}>40 мин</option><option value={50}>50 мин</option>
            <option value={60}>60 мин</option><option value={90}>90 мин</option><option value={120}>120 мин</option>
          </AdminSelect></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <AdminButton type="button" size="sm" onClick={setNextMonth}>Следующие 30 дней</AdminButton>
          {PRESETS.map((p) => (<AdminButton type="button" variant="outline" size="sm" key={p.label} onClick={() => applyPreset(p)}>{p.label}</AdminButton>))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-medium text-[var(--bs-muted)]">Рабочие дни:</span>{WEEKDAYS.map((day) => <AdminButton type="button" size="sm" variant={weekdays.has(day.value)?'secondary':'outline'} key={day.value} aria-pressed={weekdays.has(day.value)} onClick={() => toggleWeekday(day.value)}>{day.label}</AdminButton>)}</div>
        <p className="mb-4 text-xs leading-5 text-[var(--bs-muted)]">Для физической и психологической реабилитации используется шаг 90 минут: например 09:30, 11:00, 12:30. Пересекающиеся окна и добавленные перерывы блокируются автоматически.</p>
        <ScheduleBreakEditor value={planBreaks} onChange={setPlanBreaks} disabled={operationPending}/>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton type="button" variant="outline" disabled={operationPending} onClick={()=>fetchPreview()}><Eye className="w-4 h-4" /> Предпросмотр</AdminButton>
          <AdminButton type="button" onClick={handleCreate} disabled={!serverPreview||!previewMatches||operationPending}><Plus className="w-4 h-4" /> Применить предпросмотр</AdminButton>
          <AdminButton type="button" variant="secondary" onClick={handleCreateAll} disabled={operationPending}>
            <Layers className="w-4 h-4" /> Все направления: предпросмотр
          </AdminButton>
        </div>
        {showPreview && serverPreview && (
          <div className="mt-4 p-4 bg-[var(--bs-surface-muted)] rounded-[var(--bs-radius-card)]">
            <AdminFeedback>Новых: {serverPreview.counts.created} · существующих: {serverPreview.counts.existing} · без изменений: {serverPreview.counts.unchanged} · заблокировано: {serverPreview.counts.blocked} · защищено: {serverPreview.counts.protected} · конфликтов: {serverPreview.counts.conflicts}</AdminFeedback><p className="mb-2 text-xs">Это добавление альтернативных начал, не замена рабочего графика. Все процедуры завершаются до конца дня. Для закрытия и смены часов используйте исключения ниже.</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {serverPreview.rows.slice(0,100).map((s, i) => (<AdminBadge key={i} className="font-mono">{s.day} {format(s.time,'HH:mm')} {s.service} · {s.result}</AdminBadge>))}
            </div>
          </div>
        )}
      </AdminCard>
      <SchedulingTemplates from={dateFrom} to={dateTo||dateFrom} dates={selectedDates} hours={{start:timeFrom,end:timeTo,step,services:[serviceType as 'bfm'|'brt'|'psychology'],breaks:planBreaks}} onChanged={()=>void fetchSlots()}/>
      <AdminCard className="mb-6 p-5"><h3 className="font-semibold">Скопировать рабочий день на выбранные даты</h3><p className="mt-1 text-xs text-[var(--bs-muted)]">Переносятся рабочий диапазон, направления и перерывы, но не клиентские записи. Начала проверяются сервером.</p><label className="mt-3 block text-xs">Исходная дата<AdminInput type="date" value={copySource} onChange={e=>{setCopySource(e.target.value);setCopyPreview(null);}} className="mt-1"/></label><AdminButton type="button" variant="outline" disabled={operationPending||!copySource||!selectedDates.length} className="mt-3" onClick={()=>copyDay()}>Предпросмотр копирования</AdminButton>{copyPreview&&<div className="mt-3 text-sm"><AdminFeedback>Новых окон: {copyPreview.counts.created} · существующих: {copyPreview.counts.existing} · заблокированных: {copyPreview.counts.blocked} · защищённых: {copyPreview.counts.protected}</AdminFeedback><AdminButton type="button" disabled={operationPending} className="mt-3" onClick={()=>copyDay(true)}>Применить копирование</AdminButton></div>}</AdminCard>

      {showConfirm && (
        <AdminConfirmDialog title={`Удалить ${deleteMode === "all_free" ? allFreeSlots.length : selected.size} слотов?`} onCancel={() => setShowConfirm(false)} onConfirm={deleteSelected}>
          <p>Период: {loadFrom} — {loadTo}. Направление: {filterType||'все'}. Только показанные или выбранные UUID. Связанные с клиентами и историей окна не удаляются. Удаление несвязанных окон нельзя отменить.</p>
        </AdminConfirmDialog>
      )}

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Загрузка расписания">{[1,2,3].map((i) => (<AdminSkeleton key={i} className="h-20" />))}</div>
      ) : loadError&&slots.length===0 ? <p className="p-6">Расписание не загружено. Повторите загрузку.</p> : view==='timeline'?<div className="space-y-6">{timelineRules.map(rule=><div key={rule.day}><h3 className="mb-3 text-sm font-semibold">{format(moscowDate(rule.day),'d MMMM yyyy',{locale:ru})}</h3><ScheduleTimeline days={[moscowDate(rule.day)]} slots={timelineSlots.filter(s=>format(s.slot_time,'yyyy-MM-dd')===rule.day&&(!filterType||s.service_type===filterType)&&(filterFree===null||s.is_booked!==filterFree))} bookings={timelineBookings} breaks={scheduleBreaks} rules={[rule]} onSlot={s=>router.push(`/admin/calendar?date=${format(s.slot_time,'yyyy-MM-dd')}`)} onBreak={b=>setBreakDate(format(b.starts_at,'yyyy-MM-dd'))}/></div>)}</div>: Object.keys(grouped).length === 0 ? (
        <AdminCard><AdminEmptyState title="Нет будущих слотов" /></AdminCard>
      ) : (
        <div className="space-y-6">
          {freeSlots.length > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--bs-muted)] mb-4 cursor-pointer">
              <AdminCheckbox checked={selected.size === freeSlots.length && freeSlots.length > 0} onChange={toggleAll} />Выбрать все свободные
            </label>
          )}
          {Object.entries(grouped).map(([day, daySlots]) => (
            <div key={day}><h3 className="text-sm font-semibold text-[var(--bs-foreground)] mb-3">{day}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {daySlots.map((slot) => {
                  const type = SERVICE_TYPES.find((t) => t.value === slot.service_type);
                  return (
                    <AdminCard key={slot.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 border-l-4 text-sm ${slot.is_break ? "border-l-[var(--bs-warning)]" : slot.is_booked ? "border-l-[var(--bs-border-strong)]" : selected.has(slot.id) ? "border-l-[var(--bs-primary)] ring-2 ring-[var(--bs-primary)]" : slot.service_type==='bfm' ? "border-l-[var(--bs-warning)]" : slot.service_type==='brt' ? "border-l-[var(--bs-success)]" : "border-l-[var(--bs-info)]"}`}>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {(!slot.is_booked||slot.is_break) && <AdminCheckbox aria-label={`Выбрать ${format(slot.slot_time,'dd.MM HH:mm')} ${type?.label}`} checked={selected.has(slot.id)} onChange={() => toggleSelect(slot.id)} />}
                        <span className="font-medium">{format(parseISO(slot.slot_time), "HH:mm")}</span>
                        <AdminBadge tone={slot.service_type==='bfm'?'warning':slot.service_type==='brt'?'success':'info'}>{type?.label}</AdminBadge>
                      </div>
                      <AdminBadge tone={slot.is_closed||slot.is_break?'warning':slot.is_booked?'destructive':'success'}>{slot.is_closed?'Закрыто графиком':slot.is_break ? "Перерыв" : slot.is_booked ? "Недоступен" : "Свободен"}</AdminBadge>
                    </AdminCard>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {nextOffset!==null&&<AdminButton type="button" variant="outline" disabled={loading} className="mt-6 w-full" onClick={()=>fetchSlots(true)}>Загрузить следующие окна · показано {slots.length} из {counts.total}</AdminButton>}
    </div>
  );
}
