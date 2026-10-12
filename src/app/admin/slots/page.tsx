"use client";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";

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
      <div className="sticky top-0 z-20 bg-[#F6F5F2]/90 backdrop-blur-md pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-xl font-semibold text-[#111827]">Доступное время</h2><p className="mt-1 text-xs text-[#6B7280]">Московское время</p></div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "list" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>Список</button>
              <button onClick={() => setView("timeline")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "timeline" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>По времени</button>
            </div>
            <button onClick={()=>fetchSlots()} aria-label="Обновить расписание" className="min-h-11 min-w-11 rounded-xl hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-[#6B7280]" /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
          {[{ label: "Всего", value: stats.total }, { label: "Свободно", value: stats.free }, { label: "Занято", value: stats.booked }, { label: "Перерывы", value: stats.breaks }].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-2xl p-3 text-center"><div className="text-2xl font-bold text-[#111827]">{s.value}</div><div className="text-xs text-[#6B7280]">{s.label}</div></div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilterFree(filterFree === true ? null : true)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterFree === true ? "bg-green-100 text-green-700" : "bg-white border text-[#6B7280]"}`}>Свободные</button>
          <button onClick={() => setFilterFree(filterFree === false ? null : false)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterFree === false ? "bg-red-100 text-red-700" : "bg-white border text-[#6B7280]"}`}>Занятые</button>
          {SERVICE_TYPES.map((t) => (<button key={t.value} onClick={() => setFilterType(filterType === t.value ? null : t.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterType === t.value ? t.badge : "bg-white border text-[#6B7280]"}`}>{t.label}</button>))}
          {selected.size > 0 && (
            <button onClick={() => { setDeleteMode("selected"); setShowConfirm(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">
              <Trash2 className="w-3 h-3" /> Удалить выбранные ({selected.size})
            </button>
          )}
          {selected.size>0&&<><button disabled={operationPending} className="min-h-11 rounded-xl border px-3 text-xs disabled:opacity-50" onClick={()=>windowAction(true)}>Закрыть выбранное время</button><button disabled={operationPending} className="min-h-11 rounded-xl border px-3 text-xs disabled:opacity-50" onClick={()=>windowAction(false)}>Снять закрытие выбранных окон</button></>}
          {allFreeSlots.length > 0 && (
            <button onClick={() => { setDeleteMode("all_free"); setShowConfirm(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">
              <Trash2 className="w-3 h-3" /> Удалить свободные на этой странице ({allFreeSlots.length})
            </button>
          )}
        </div>
      </div>
      <div className="mb-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
        <label className="text-xs">Показывать с<input type="date" value={loadFrom} onChange={e=>setLoadFrom(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
        <label className="text-xs">Показывать по<input type="date" value={loadTo} onChange={e=>setLoadTo(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
        <p className="text-xs text-gray-500 sm:col-span-2">Счётчики относятся к выбранным датам и фильтрам. Удаление — только для явно выбранных или показанных окон. Исторически связанные окна защищены.</p>
      </div>
      {loadError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError} · Ранее загруженные данные могут быть устаревшими.</p>}

      <div className="mb-6 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Coffee className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#111827]">Добавить перерыв</h3><p className="mt-1 text-xs leading-5 text-[#6B7280]">Перерыв закроет для записи все пересекающиеся окна во всех направлениях.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <label className="text-xs font-medium text-[#6B7280]">Дата<input type="date" value={breakDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setBreakDate(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">С<input type="time" value={breakFrom} onChange={(event) => setBreakFrom(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">До<input type="time" value={breakTo} onChange={(event) => setBreakTo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">Причина<input value={breakReason} maxLength={200} onChange={(event) => setBreakReason(event.target.value)} placeholder="Например: стоматолог" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <button type="button" onClick={createBreak} disabled={savingBreak} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />{savingBreak ? "Добавляем…" : "Добавить"}</button>
        </div>
        {scheduleBreaks.length > 0 && <details className="mt-5"><summary className="min-h-11 cursor-pointer text-sm">Перерывы и ограничения графика ({scheduleBreaks.length})</summary><div className="grid gap-2 md:grid-cols-2">{scheduleBreaks.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3"><Clock3 className="h-4 w-4 shrink-0 text-violet-700" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#111827]">{format(parseISO(item.starts_at), "d MMMM, HH:mm", { locale: ru })}–{format(parseISO(item.ends_at), "d MMMM, HH:mm",{locale:ru})}</p><p className="text-xs text-[#6B7280]">{item.reason || "Перерыв"} · {item.source_type==='template'?'Недельный график':item.source_type==='exception'?'Исключение дня':item.source_type==='window'?'Закрытое окно':'Ручной перерыв'}</p></div>{(!item.source_type||item.source_type==='manual')&&<button type="button" onClick={() => removeBreak(item.id)} disabled={deletingBreakId === item.id} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-100 disabled:opacity-50" aria-label={`Удалить перерыв ${item.reason}`}><Trash2 className="h-4 w-4" /></button>}</div>)}</div></details>}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6 shadow-sm">
        <h3 className="font-semibold text-[#111827] mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Открыть время для записи</h3>
        <div className="mb-4 flex flex-wrap gap-2">{(['range','weekdays','dates'] as const).map(mode=><button key={mode} onClick={()=>setDateMode(mode)} aria-pressed={dateMode===mode} className={`min-h-11 rounded-xl border px-3 text-sm ${dateMode===mode?'bg-gray-900 text-white':'bg-white'}`}>{mode==='range'?'Диапазон':mode==='weekdays'?'Дни недели':'Произвольные даты'}</button>)}</div>
        <div className="mb-4 flex flex-wrap gap-2"><label className="text-xs">Добавить или исключить дату<input type="date" value={pickDate} onChange={e=>setPickDate(e.target.value)} className="mt-1 block min-h-11 rounded-xl border px-3"/></label><button disabled={!pickDate} className="min-h-11 self-end rounded-xl border px-3 text-sm disabled:opacity-50" onClick={()=>{setCustomDates(d=>[...new Set([...d,pickDate])].sort());setExcludedDates(d=>d.filter(a=>a!==pickDate));setDateMode('dates');}}>Добавить дату</button><button disabled={!pickDate} className="min-h-11 self-end rounded-xl border px-3 text-sm disabled:opacity-50" onClick={()=>setExcludedDates(d=>[...new Set([...d,pickDate])].sort())}>Исключить дату</button></div>
        <div className="mb-4 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{selectedDates.map(d=><button key={d} className="min-h-11 rounded-lg border bg-gray-50 px-2 text-xs" aria-label={`Исключить ${d}`} onClick={()=>setExcludedDates(a=>[...a,d])}>{d} ×</button>)}{excludedDates.map(d=><button key={d} className="min-h-11 rounded-lg border bg-red-50 px-2 text-xs text-red-700" onClick={()=>setExcludedDates(a=>a.filter(v=>v!==d))}>{d} исключена · вернуть</button>)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <label className="grid gap-2 text-xs">Направление<select value={serviceType} onChange={(e) => { const value = e.target.value; setServiceType(value); setStep(value === "brt" ? 60 : 90); }} className="h-10 w-full rounded-xl border px-3 text-sm">
            {SERVICE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select></label>
          <label className="grid gap-2 text-xs">С даты<input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (!dateTo) setDateTo(e.target.value); }} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">По дату включительно<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">Начало рабочего дня<input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">Конец рабочего дня<input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">Интервал между началами<select value={step} onChange={(e) => setStep(Number(e.target.value))} className="h-10 w-full rounded-xl border px-3 text-sm">
            <option value={30}>30 мин</option><option value={40}>40 мин</option><option value={50}>50 мин</option>
            <option value={60}>60 мин</option><option value={90}>90 мин</option><option value={120}>120 мин</option>
          </select></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={setNextMonth} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>Следующие 30 дней</button>
          {PRESETS.map((p) => (<button key={p.label} onClick={() => applyPreset(p)} className="px-3 py-1.5 rounded-full text-xs bg-gray-100 hover:bg-gray-200 text-[#6B7280] transition-colors">{p.label}</button>))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-medium text-[#6B7280]">Рабочие дни:</span>{WEEKDAYS.map((day) => <button type="button" key={day.value} aria-pressed={weekdays.has(day.value)} onClick={() => toggleWeekday(day.value)} className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-semibold transition-all ${weekdays.has(day.value) ? "bg-violet-700 text-white" : "border bg-white text-[#6B7280]"}`}>{day.label}</button>)}</div>
        <p className="mb-4 text-xs leading-5 text-[#6B7280]">Для физической и психологической реабилитации используется шаг 90 минут: например 09:30, 11:00, 12:30. Пересекающиеся окна и добавленные перерывы блокируются автоматически.</p>
        <ScheduleBreakEditor value={planBreaks} onChange={setPlanBreaks} disabled={operationPending}/>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={operationPending} onClick={()=>fetchPreview()} className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors text-[#111827] disabled:opacity-50"><Eye className="w-4 h-4" /> Предпросмотр</button>
          <button onClick={handleCreate} disabled={!serverPreview||!previewMatches||operationPending} className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}><Plus className="w-4 h-4" /> Применить предпросмотр</button>
          <button onClick={handleCreateAll} disabled={operationPending} className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition-all">
            <Layers className="w-4 h-4" /> Все направления: предпросмотр
          </button>
        </div>
        {showPreview && serverPreview && (
          <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
            <p className="text-sm font-medium text-[#111827] mb-2">Новых: {serverPreview.counts.created} · существующих: {serverPreview.counts.existing} · без изменений: {serverPreview.counts.unchanged} · заблокировано: {serverPreview.counts.blocked} · защищено: {serverPreview.counts.protected} · конфликтов: {serverPreview.counts.conflicts}</p><p className="mb-2 text-xs">Это добавление альтернативных начал, не замена рабочего графика. Все процедуры завершаются до конца дня. Для закрытия и смены часов используйте исключения ниже.</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {serverPreview.rows.slice(0,100).map((s, i) => (<span key={i} className="px-2.5 py-1 rounded-lg bg-white border text-xs font-mono text-[#6B7280]">{s.day} {format(s.time,'HH:mm')} {s.service} · {s.result}</span>))}
            </div>
          </div>
        )}
      </div>
      <SchedulingTemplates from={dateFrom} to={dateTo||dateFrom} dates={selectedDates} hours={{start:timeFrom,end:timeTo,step,services:[serviceType as 'bfm'|'brt'|'psychology'],breaks:planBreaks}} onChanged={()=>void fetchSlots()}/>
      <section className="mb-6 rounded-2xl border bg-white p-5"><h3 className="font-semibold">Скопировать рабочий день на выбранные даты</h3><p className="mt-1 text-xs text-gray-500">Переносятся рабочий диапазон, направления и перерывы, но не клиентские записи. Начала проверяются сервером.</p><label className="mt-3 block text-xs">Исходная дата<input type="date" value={copySource} onChange={e=>{setCopySource(e.target.value);setCopyPreview(null);}} className="mt-1 min-h-11 rounded-xl border px-3"/></label><button disabled={operationPending||!copySource||!selectedDates.length} className="mt-3 min-h-11 rounded-xl border px-4 text-sm disabled:opacity-50" onClick={()=>copyDay()}>Предпросмотр копирования</button>{copyPreview&&<div className="mt-3 text-sm"><p>Новых окон: {copyPreview.counts.created} · существующих: {copyPreview.counts.existing} · заблокированных: {copyPreview.counts.blocked} · защищённых: {copyPreview.counts.protected}</p><button disabled={operationPending} className="mt-3 min-h-11 rounded-xl bg-gray-900 px-4 text-white disabled:opacity-50" onClick={()=>copyDay(true)}>Применить копирование</button></div>}</section>

      {showConfirm && (
        <AdminConfirmDialog title={`Удалить ${deleteMode === "all_free" ? allFreeSlots.length : selected.size} слотов?`} onCancel={() => setShowConfirm(false)} onConfirm={deleteSelected}>
          <p>Период: {loadFrom} — {loadTo}. Направление: {filterType||'все'}. Только показанные или выбранные UUID. Связанные с клиентами и историей окна не удаляются. Удаление несвязанных окон нельзя отменить.</p>
        </AdminConfirmDialog>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => (<div key={i} className="h-20 rounded-2xl bg-white border border-gray-100 animate-pulse" />))}</div>
      ) : loadError&&slots.length===0 ? <p className="p-6">Расписание не загружено. Повторите загрузку.</p> : view==='timeline'?<div className="space-y-6">{timelineRules.map(rule=><div key={rule.day}><h3 className="mb-3 text-sm font-semibold">{format(moscowDate(rule.day),'d MMMM yyyy',{locale:ru})}</h3><ScheduleTimeline days={[moscowDate(rule.day)]} slots={timelineSlots.filter(s=>format(s.slot_time,'yyyy-MM-dd')===rule.day&&(!filterType||s.service_type===filterType)&&(filterFree===null||s.is_booked!==filterFree))} bookings={timelineBookings} breaks={scheduleBreaks} rules={[rule]} onSlot={s=>router.push(`/admin/calendar?date=${format(s.slot_time,'yyyy-MM-dd')}`)} onBreak={b=>setBreakDate(format(b.starts_at,'yyyy-MM-dd'))}/></div>)}</div>: Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100"><Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-[#6B7280]">Нет будущих слотов</p></div>
      ) : (
        <div className="space-y-6">
          {freeSlots.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-[#6B7280] mb-4 cursor-pointer">
              <input type="checkbox" checked={selected.size === freeSlots.length && freeSlots.length > 0} onChange={toggleAll} className="rounded" />Выбрать все свободные
            </label>
          )}
          {Object.entries(grouped).map(([day, daySlots]) => (
            <div key={day}><h3 className="text-sm font-semibold text-[#111827] mb-3">{day}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {daySlots.map((slot) => {
                  const type = SERVICE_TYPES.find((t) => t.value === slot.service_type);
                  return (
                    <div key={slot.id} className={`flex items-center justify-between p-2.5 rounded-xl border-l-4 text-sm transition-all ${slot.is_break ? "border-l-violet-500 bg-violet-50" : slot.is_booked ? "bg-gray-50 border-l-gray-300 opacity-60" : selected.has(slot.id) ? "bg-teal-50 border-l-teal-400 ring-2 ring-teal-300" : `${type?.color} bg-white hover:shadow-sm`}`}>
                      <div className="flex items-center gap-2">
                        {(!slot.is_booked||slot.is_break) && <input type="checkbox" aria-label={`Выбрать ${format(slot.slot_time,'dd.MM HH:mm')} ${type?.label}`} checked={selected.has(slot.id)} onChange={() => toggleSelect(slot.id)} className="h-5 w-5 rounded" />}
                        <span className="font-medium">{format(parseISO(slot.slot_time), "HH:mm")}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${type?.badge}`}>{type?.label}</span>
                      </div>
                      <span className={`text-xs ${slot.is_break ? "font-medium text-violet-700" : slot.is_booked ? "text-red-500" : "text-green-600"}`}>{slot.is_break ? "Перерыв" : slot.is_booked ? "Занят" : "Свободен"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {nextOffset!==null&&<button disabled={loading} className="mt-6 min-h-11 w-full rounded-xl border bg-white px-4 text-sm" onClick={()=>fetchSlots(true)}>Загрузить следующие окна · показано {slots.length} из {counts.total}</button>}
    </div>
  );
}
