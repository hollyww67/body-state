"use client";
import AdminConfirmDialog, { AdminModal } from "@/components/admin/AdminConfirmDialog";
import { AdminButton, AdminInput, AdminSelect, AdminField, AdminStatCard } from '@/components/admin/ui';

import { useCallback, useEffect, useMemo, useRef,useState } from "react";
import Link from 'next/link';
import ScheduleTimeline,{type CalendarSlot,type CalendarDay} from '@/components/admin/ScheduleTimeline';
import BookingStatusBadge from '@/components/admin/bookings/BookingStatusBadge';
import SchedulingClientPicker from '@/components/admin/SchedulingClientPicker';
import {
  addDays, addMonths, endOfMonth, endOfWeek,
  parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { formatMoscow as format, sameMoscowDay as isSameDay, sameMoscowMonth as isSameMonth, moscowDate, moscowInputToISO } from "@/lib/moscow-time";
import { ru } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Check,
  Clock3, CalendarDays, Search, X, Phone, Coffee, Trash2,
} from "lucide-react";
import type { Booking, BookingStatus, ServiceType } from "@/lib/api/bookings";
import { patchBooking, TYPE_LABELS } from "@/lib/api/bookings";
import { formatRussianPhoneInput } from "@/lib/phone";
import { toast } from "sonner";

const SERVICE_TYPES: { value: ServiceType; label: string; color: string; bg: string }[] = [
  { value: "bfm", label: "Физическая реабилитация", color: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "brt", label: "БРТ", color: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "psychology", label: "Психологическая реабилитация", color: "bg-sky-500", bg: "bg-sky-50 text-sky-700 border-sky-200" },
];

interface ScheduleBreak {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  source_type?: string;
}

export default function AdminCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [scheduleBreaks, setScheduleBreaks] = useState<ScheduleBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState('');
  const [view,setView]=useState<'month'|'week'|'day'>('week');
  const [slots,setSlots]=useState<CalendarSlot[]>([]);
  const [dayRules,setDayRules]=useState<CalendarDay[]>([]);
  const sequence=useRef(0),loadedRange=useRef(''),controller=useRef<AbortController|null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => moscowDate());
  const [selectedDay, setSelectedDay] = useState<Date>(() => moscowDate());
  useEffect(()=>{const date=new URLSearchParams(window.location.search).get('date');if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){const day=moscowDate(`${date}T12:00:00+03:00`);if(Number.isFinite(day.getTime())){setSelectedDay(day);setCurrentMonth(day);setView('day');}}else if(window.matchMedia('(max-width: 640px)').matches){setView('day');}},[]);
  const [search, setSearch] = useState("");
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ServiceType | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusConfirmation,setStatusConfirmation]=useState<{id:string;status:BookingStatus;name:string}|null>(null);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newTime, setNewTime] = useState("10:00"); const [adding, setAdding] = useState(false);
  const [newConsent,setNewConsent]=useState(false);
  const createRequest=useRef({signature:'',key:''});
  const [newSlotId,setNewSlotId]=useState<string|null>(null);
  const [newAccountId,setNewAccountId]=useState<string|null>(null),[newIdentity,setNewIdentity]=useState(false);
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  const [breakReason, setBreakReason] = useState("");
  const [savingBreak, setSavingBreak] = useState(false);
  const [deletingBreakId, setDeletingBreakId] = useState<string | null>(null);
  const [slotDetails,setSlotDetails]=useState<CalendarSlot|null>(null),[breakDetails,setBreakDetails]=useState<ScheduleBreak|null>(null),[windowPending,setWindowPending]=useState(false);
  const openNewBooking=(slot?:CalendarSlot)=>{
    setNewConsent(false);setNewAccountId(null);setNewIdentity(false);setNewName('');setNewPhone('');setNewSlotId(slot?.id??null);
    if(slot){setSelectedDay(moscowDate(slot.slot_time));setNewTime(format(slot.slot_time,'HH:mm'));setNewService(slot.service_type as ServiceType);}
    setSlotDetails(null);setShowAddModal(true);
  };
  const closeWindow=async()=>{
    if(!slotDetails||windowPending)return;setWindowPending(true);
    try{const response=await fetch('/api/admin/scheduling',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'close-windows',ids:[slotDetails.id]})});const data=await response.json();if(!response.ok)throw Error(data.error);setSlotDetails(null);await fetchCalendar();toast.success('Окно закрыто для всех пересекающихся услуг');}catch(e){toast.error(e instanceof Error?e.message:'Не удалось закрыть окно');}finally{setWindowPending(false);}
  };

  const rangeStart=view==='month'?startOfWeek(startOfMonth(currentMonth),{weekStartsOn:1}):view==='week'?startOfWeek(selectedDay,{weekStartsOn:1}):selectedDay;
  const rangeEnd=view==='month'?endOfWeek(endOfMonth(currentMonth),{weekStartsOn:1}):view==='week'?addDays(rangeStart,6):selectedDay;
  const rangeFrom=format(rangeStart,'yyyy-MM-dd'),rangeTo=format(rangeEnd,'yyyy-MM-dd');
  const fetchCalendar = useCallback(async () => {
    const seq=++sequence.current;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    try {
      if(loadedRange.current!==`${rangeFrom}:${rangeTo}`) setLoading(true);
      const response=await fetch(`/api/admin/calendar?from=${rangeFrom}&to=${rangeTo}`,{signal:abort.signal,cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Не удалось загрузить календарь');
      if(seq!==sequence.current)return;
      setBookings(data.bookings);setSlots(data.slots);setDayRules(data.days);setScheduleBreaks(data.breaks);
      loadedRange.current=`${rangeFrom}:${rangeTo}`;setLoadError('');
    }
    catch(error) {if(!abort.signal.aborted&&seq===sequence.current){setLoadError(error instanceof Error?error.message:'Календарь недоступен');toast.error('Не удалось загрузить календарь');}}
    finally { if(seq===sequence.current)setLoading(false); }
  }, [rangeFrom,rangeTo]);

  useEffect(() => { fetchCalendar(); const i = setInterval(fetchCalendar, 30000); return () => {clearInterval(i);controller.current?.abort();}; }, [fetchCalendar]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase();
      return (!q || b.client_name?.toLowerCase().includes(q) || b.client_phone?.includes(q)) &&
        (selectedType === "all" || b.service_type === selectedType);
    });
  }, [bookings, search, selectedType]);

  const handleStatusChange = async (id: string, status: BookingStatus) => {
    if(updatingId)return;setUpdatingId(id);
    try { await patchBooking(id, status);await fetchCalendar(); } finally { setUpdatingId(null); }
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault(); if(adding||!newConsent)return;setAdding(true);
    try {
      const slotTime = moscowInputToISO(format(selectedDay, "yyyy-MM-dd"), newTime);
      const payload={service_type: newService, slot_id:newSlotId,slot_time: slotTime, client_name: newName, client_phone: newPhone, consent_confirmed: newConsent,account_user_id:newAccountId,identity_confirmed:newIdentity};
      const signature=JSON.stringify(payload);if(createRequest.current.signature!==signature)createRequest.current={signature,key:crypto.randomUUID()};

      const bookingRes = await fetch("/api/admin/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...payload,request_key:createRequest.current.key}),
      });
      const result = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(result.error || "Не удалось создать запись");
      createRequest.current={signature:'',key:''};
      setShowAddModal(false); setNewName(""); setNewPhone(""); setNewTime("10:00");setNewConsent(false);setNewSlotId(null); await fetchCalendar(); toast.success("Запись создана");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать запись");
    } finally { setAdding(false); }
  };
  const addWindowOnly=async()=>{
    if(adding)return;setAdding(true);
    try{const response=await fetch('/api/admin/slots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_type:newService,slot_time:moscowInputToISO(format(selectedDay,'yyyy-MM-dd'),newTime)})});const data=await response.json();if(!response.ok)throw Error(data.error);setShowAddModal(false);await fetchCalendar();toast.success(data.created?'Окно добавлено':'Окно уже существует');}catch(e){toast.error(e instanceof Error?e.message:'Не удалось добавить окно');}finally{setAdding(false);}
  };

  const handleAddBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    const date = format(selectedDay, "yyyy-MM-dd");
    const startsAt = new Date(moscowInputToISO(date, breakFrom));
    const endsAt = new Date(moscowInputToISO(date, breakTo));
    if (endsAt <= startsAt) return toast.error("Окончание должно быть позже начала");
    setSavingBreak(true);
    try {
      const response = await fetch("/api/admin/schedule-breaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: breakReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось добавить перерыв");
      setShowBreakModal(false); setBreakReason(""); await fetchCalendar(); toast.success("Перерыв добавлен");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить перерыв");
    } finally { setSavingBreak(false); }
  };

  const handleDeleteBreak = async (id: string) => {
    setDeletingBreakId(id);
    try {
      const response = await fetch(`/api/admin/schedule-breaks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить перерыв");
      await fetchCalendar(); toast.success("Перерыв удалён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить перерыв");
    } finally { setDeletingBreakId(null); }
  };

  const monthStart = startOfMonth(currentMonth); const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = []; let day = calStart;
  while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

  const getDayBookings = (d: Date) => {
    return filteredBookings.filter((b) => b.slot_time && isSameDay(parseISO(b.slot_time), d))
      .sort((a, b) => new Date(a.slot_time!).getTime() - new Date(b.slot_time!).getTime());
  };

  const getDayBreaks = (d: Date) => {
    const dayStart = moscowDate(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);
    return scheduleBreaks.filter((item) => parseISO(item.starts_at) < dayEnd && parseISO(item.ends_at) > dayStart)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  };

  const selectedBookings = getDayBookings(selectedDay);
  const selectedBreaks = getDayBreaks(selectedDay);
  const selectedRule = dayRules.find(rule=>rule.day===format(selectedDay,'yyyy-MM-dd'));
  const selectedWindows = slots.filter(slot=>!slot.is_booked&&isSameDay(slot.slot_time,selectedDay)&&(selectedType==='all'||slot.service_type===selectedType));
  const stats = {
    today: getDayBookings(moscowDate()).length,
    total: filteredBookings.length,
    completed: bookings.filter((b) => b.status === "completed").length,
    week: filteredBookings.filter((b) => { if (!b.slot_time) return false; const d = parseISO(b.slot_time); return d >= new Date() && d <= addDays(moscowDate(), 7); }).length,
  };

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="admin-calendar-page min-h-screen bg-[var(--bs-background)]" data-mobile-tools={mobileToolsOpen}>
      <header className="healthcare-calendar-title"><div><h2>Календарь записей</h2><p>Расписание приёмов · Московское время</p></div><AdminButton className="healthcare-calendar-mobile-tools" variant="outline" size="icon" aria-label="Поиск, фильтры и режим календаря" aria-expanded={mobileToolsOpen} aria-controls="calendar-tools" onClick={()=>setMobileToolsOpen(open=>!open)}><Search aria-hidden="true" size={18}/></AdminButton><AdminButton aria-label="Новая запись" onClick={()=>openNewBooking()}><Plus aria-hidden="true" size={18}/>Новая запись</AdminButton></header>
      <div id="calendar-tools" className="healthcare-calendar-toolbar bg-[var(--bs-surface)] border-b border-[var(--bs-border)]">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="admin-mobile-toolbar flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-[280px]"><Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-muted)]" /><AdminInput aria-label="Поиск клиента в календаре" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск клиента…" className="pl-10" /></div>
              <AdminSelect aria-label="Направление записи" value={selectedType} onChange={e=>setSelectedType(e.target.value as ServiceType|'all')}><option value="all">Все направления</option>{SERVICE_TYPES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</AdminSelect>
              <AdminButton onClick={fetchCalendar} variant="outline" loading={loading}><RefreshCw className="w-4 h-4" aria-hidden="true" />Обновить</AdminButton>
            </div>
          </div>
          <div className="healthcare-calendar-stats admin-mobile-stats grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
            <AdminStatCard title="Сегодня" value={stats.today} /><AdminStatCard title="На неделе" value={stats.week} /><AdminStatCard title="Всего записей" value={stats.total} /><AdminStatCard title="Завершено" value={stats.completed} />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        {loadError&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError} · Ранее загруженные данные могут быть устаревшими.</p>}
        <div className="admin-calendar-modes" role="group" aria-label="Режим календаря">{(['month','week','day'] as const).map(mode=><AdminButton variant="ghost" key={mode} aria-pressed={view===mode} onClick={()=>setView(mode)}>{mode==='month'?'Месяц':mode==='week'?'Неделя':'День'}</AdminButton>)}</div>
        <div className="admin-calendar-layout grid grid-cols-1 xl:grid-cols-[1.2fr_420px] gap-6 items-start" data-view={view}>
          <aside className="healthcare-calendar-directions" aria-label="Направления"><h3>Направления</h3><p>Услуги в расписании</p><button type="button" aria-pressed={selectedType==='all'} onClick={()=>setSelectedType('all')}><span>Все направления</span><span>{bookings.length}</span></button>{SERVICE_TYPES.map(service=><button type="button" key={service.value} data-service={service.value} aria-pressed={selectedType===service.value} onClick={()=>setSelectedType(service.value)}><span>{service.label}</span><span>{bookings.filter(b=>b.service_type===service.value).length}</span></button>)}<p>Количество записей за выбранный период</p></aside>
          <div className="admin-calendar-grid-card bg-[var(--bs-surface)] rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] shadow-sm overflow-hidden">
            <div className="admin-calendar-header flex items-center justify-between p-6 border-b border-[var(--bs-border)]">
              <div className="flex items-center gap-3">
                <button aria-label="Предыдущий период" onClick={() => view==='month'?setCurrentMonth((m) => subMonths(m, 1)):setSelectedDay(d=>addDays(d,view==='week'?-7:-1))} className="w-11 h-11 rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronLeft className="w-5 h-5 text-[var(--bs-muted)]" /></button>
                <button aria-label="Следующий период" onClick={() => view==='month'?setCurrentMonth((m) => addMonths(m, 1)):setSelectedDay(d=>addDays(d,view==='week'?7:1))} className="w-11 h-11 rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronRight className="w-5 h-5 text-[var(--bs-muted)]" /></button>
              </div>
              <div className="text-center"><h2 className="text-xl font-semibold text-[var(--bs-foreground)] capitalize">{view==='month'?format(currentMonth, "LLLL yyyy", { locale: ru }):view==='week'?`${format(rangeStart,'dd.MM')} — ${format(rangeEnd,'dd.MM.yyyy')}`:format(selectedDay,'dd MMMM yyyy',{locale:ru})}</h2><p className="text-sm text-[var(--bs-muted)] mt-1">{filteredBookings.length} записей</p></div>
              <button onClick={() => { const today = moscowDate(); setCurrentMonth(today); setSelectedDay(today); }} className="h-11 px-4 rounded-[var(--bs-radius-control)] bg-[var(--bs-primary)] text-white text-sm font-medium hover:opacity-90 transition-all">Сегодня</button>
            </div>
            <div className="healthcare-calendar-date-strip" role="group" aria-label="Выбрать день">{Array.from({length:7},(_,i)=>addDays(startOfWeek(selectedDay,{weekStartsOn:1}),i)).map(date=><button key={format(date,'yyyy-MM-dd')} type="button" aria-label={format(date,'d MMMM, EEEE',{locale:ru})} aria-pressed={isSameDay(date,selectedDay)} onClick={()=>{setSelectedDay(date);setCurrentMonth(date);}}><span>{format(date,'EEE',{locale:ru})}</span><strong>{format(date,'d')}</strong></button>)}</div>
            {view!=='month'&&<div className="healthcare-mobile-timeline">{loading?<p role="status" className="p-4">Загрузка расписания…</p>:<ScheduleTimeline days={[selectedDay]} slots={slots.filter(s=>selectedType==='all'||s.service_type===selectedType)} bookings={filteredBookings} breaks={scheduleBreaks} rules={dayRules} onSlot={setSlotDetails} onBreak={setBreakDetails}/>}</div>}
            <div className="healthcare-calendar-desktop-grid">
            {loading?<div role="status" className="p-6 text-sm text-gray-600">Загрузка расписания…</div>:view!=='month'?<ScheduleTimeline days={Array.from({length:view==='week'?7:1},(_,i)=>addDays(rangeStart,i))} slots={slots.filter(s=>selectedType==='all'||s.service_type===selectedType)} bookings={filteredBookings} breaks={scheduleBreaks} rules={dayRules}
              onSlot={setSlotDetails}
              onBreak={setBreakDetails}/>:<>
            <div className="grid grid-cols-7 px-4 pt-4">{weekDays.map((d) => (<div key={d} className="h-12 flex items-center justify-center text-sm font-medium text-[var(--bs-muted)]">{d}</div>))}</div>
            <div className="admin-calendar-days grid grid-cols-7 gap-2 p-4">
              {days.map((d) => {
                const dayBookings = getDayBookings(d).filter(b=>!['cancelled','completed'].includes(b.status));
                const dayBreaks = getDayBreaks(d);
                const isCurrent = isSameMonth(d, currentMonth);
                const isSelected = isSameDay(d, selectedDay);
                const isToday = isSameDay(d, new Date());
                const density = dayBookings.length >= 6 ? "bg-teal-100" : dayBookings.length >= 4 ? "bg-teal-50" : "";
                return (
                  <button key={d.toISOString()} aria-pressed={isSelected} aria-label={`${format(d, 'd MMMM yyyy', {locale:ru})}, записей: ${dayBookings.length}, перерывов: ${dayBreaks.length}`} onClick={() => setSelectedDay(d)}
                    className={`admin-calendar-day relative min-h-[120px] rounded-[var(--bs-radius-card)] border p-3 text-left transition-all overflow-hidden ${!isCurrent ? "opacity-30" : "hover:shadow-lg hover:-translate-y-0.5"} ${isSelected ? "border-teal-300 bg-teal-50 ring-2 ring-teal-500/20 shadow-lg" : "border-[var(--bs-border)] bg-[var(--bs-surface)]"} ${density}`}>
                    {isToday && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-semibold ${isToday ? "text-teal-700" : "text-[var(--bs-foreground)]"}`}>{format(d, "d")}</span>
                      {dayBookings.length > 0 && <div className="px-2 py-1 rounded-full bg-[var(--bs-primary)] text-white text-[11px] font-medium">{dayBookings.length}</div>}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-emerald-700">Свободных начал: {slots.filter(s=>!s.is_booked&&isSameDay(s.slot_time,d)&&(selectedType==='all'||s.service_type===selectedType)).length}</div>
                      {dayRules.find(r=>r.day===format(d,'yyyy-MM-dd'))?.mode==='closed'&&<div className="text-[11px] text-gray-600">Закрыто</div>}
                      {!slots.some(s=>isSameDay(s.slot_time,d))&&!dayBreaks.length&&!dayBookings.length&&<div className="text-[11px] text-gray-500">Не опубликовано</div>}
                      {dayBookings.slice(0, 3).map((b) => {
                        const service = SERVICE_TYPES.find((s) => s.value === b.service_type);
                        return (<div key={b.id} className="flex items-center gap-1.5 text-[11px]"><div className={`w-1.5 h-1.5 rounded-full ${service?.color}`} /><span className="truncate text-[var(--bs-foreground)]">{b.slot_time ? format(parseISO(b.slot_time), "HH:mm") : ""}</span></div>);
                      })}
                      {dayBookings.length > 3 && <div className="text-[11px] text-[var(--bs-muted)]">+{dayBookings.length - 3}</div>}
                      {dayBreaks.length > 0 && <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700"><Coffee className="h-3 w-3" /><span className="truncate">{dayBreaks.length === 1 ? dayBreaks[0].reason || "Перерыв" : `Перерывов: ${dayBreaks.length}`}</span></div>}
                    </div>
                    <span aria-hidden="true" className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface)] shadow-sm"><Plus className="w-3.5 h-3.5" /></span>
                  </button>
                );
              })}
            </div></>}
            </div>
          </div>

          <section className="healthcare-calendar-context" aria-label="Рабочий день">
            <h3>{format(selectedDay,'d MMMM',{locale:ru})}</h3>
            <p>{loading?'Загрузка расписания…':selectedRule?.mode==='closed'?'День закрыт':selectedRule?.mode==='published'?'Расписание опубликовано':'Время не опубликовано'} · МСК</p>
            <dl><div><dt>Записи</dt><dd>{loading?'—':selectedBookings.length}</dd></div><div><dt>Свободные начала</dt><dd>{loading?'—':selectedWindows.length}</dd></div><div><dt>Перерывы</dt><dd>{loading?'—':selectedBreaks.length}</dd></div></dl>
            <p>Свободные начала — альтернативы для выбора времени, а не отдельные кабинеты.</p>
            <AdminButton disabled={loading} onClick={()=>openNewBooking()}><Plus size={16} aria-hidden="true"/>Создать запись</AdminButton>
            <AdminButton variant="outline" onClick={()=>setShowBreakModal(true)}><Coffee size={16} aria-hidden="true"/>Добавить перерыв</AdminButton>
            <Link href="/admin/slots">Управление расписанием<ChevronRight size={16} aria-hidden="true"/></Link>
          </section>
          <div className="admin-calendar-detail sticky top-28">
            <div className="bg-[var(--bs-surface)] rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-[var(--bs-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold text-[var(--bs-foreground)]">{format(selectedDay, "d MMMM, EEEE", { locale: ru })}</h3><p className="text-sm text-[var(--bs-muted)] mt-1">{selectedBookings.length} записей · {selectedBreaks.length} перерывов</p></div>
                  <div className="flex flex-wrap justify-end gap-2"><button onClick={() => setShowBreakModal(true)} className="h-11 px-3 rounded-[var(--bs-radius-control)] border border-violet-200 bg-violet-50 text-violet-700 flex items-center gap-2 text-sm font-medium hover:bg-violet-100 transition-all"><Coffee className="w-4 h-4" />Перерыв</button><button onClick={() => openNewBooking()} className="h-11 px-3 rounded-[var(--bs-radius-control)] bg-[var(--bs-primary)] text-white flex items-center gap-2 text-sm font-medium hover:opacity-90 transition-all"><Plus className="w-4 h-4" />Запись</button></div>
                </div>
              </div>
              <div className="max-h-[760px] overflow-y-auto p-6">
                {loading ? (
                  <div className="space-y-3">{[...Array(6)].map((_, i) => (<div key={i} className="h-28 rounded-[var(--bs-radius-card)] bg-gray-100 animate-pulse" />))}</div>
                ) : selectedBookings.length === 0 && selectedBreaks.length === 0 ? (
                  <div className="text-center py-20"><div className="w-16 h-16 rounded-[var(--bs-radius-card)] bg-gray-100 flex items-center justify-center mx-auto mb-4"><CalendarDays className="w-6 h-6 text-[var(--bs-muted)]" /></div><h4 className="font-semibold text-[var(--bs-foreground)]">Нет событий</h4><p className="text-sm text-[var(--bs-muted)] mt-1">Добавьте запись или перерыв</p></div>
                ) : (
                  <div className="space-y-4">
                    {selectedBreaks.map((item) => (
                      <div key={item.id} className="rounded-[var(--bs-radius-card)] border border-violet-200 bg-violet-50 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--bs-radius-control)] bg-violet-600 text-white"><Coffee className="h-5 w-5" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div><h4 className="font-semibold text-violet-950">{item.reason || "Перерыв"}</h4><p className="mt-1 text-sm text-violet-700">{format(parseISO(item.starts_at), "d MMM, HH:mm", { locale: ru })} — {format(parseISO(item.ends_at), "d MMM, HH:mm", { locale: ru })}</p></div>
                              {(!item.source_type||item.source_type==='manual')&&<button type="button" onClick={() => handleDeleteBreak(item.id)} disabled={deletingBreakId === item.id} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-violet-600 hover:bg-violet-100 disabled:opacity-50" aria-label="Удалить перерыв"><Trash2 className="h-4 w-4" /></button>}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-violet-700">Запись на пересекающееся время недоступна для всех услуг.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedBookings.map((booking) => {
                      const service = SERVICE_TYPES.find((s) => s.value === booking.service_type);
                      return (
                        <div key={booking.id} data-service={booking.service_type} className="healthcare-calendar-booking relative rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] bg-[var(--bs-surface)] p-5 shadow-sm hover:shadow-lg transition-all">
                          <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-100" />
                          <div className="admin-calendar-appointment relative flex gap-4">
                            <div className="relative z-10 shrink-0">
                              <div className={`w-16 h-16 rounded-[var(--bs-radius-control)] flex flex-col items-center justify-center text-white shadow-lg ${service?.color}`}><Clock3 className="w-4 h-4 mb-1" /><span className="text-xs font-semibold">{booking.slot_time ? format(parseISO(booking.slot_time), "HH:mm") : ""}</span></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap"><h4 className="font-semibold text-[var(--bs-foreground)]">{booking.client_name}</h4><span className={`px-2 py-1 rounded-full border text-[11px] font-medium ${service?.bg}`}>{TYPE_LABELS[booking.service_type]}</span></div>
                                  <div className="flex items-center gap-2 mt-2 text-sm text-[var(--bs-muted)]"><Phone className="w-3.5 h-3.5" /><span>{booking.client_phone}</span></div>
                                </div>
                                <div className="space-y-1"><BookingStatusBadge status={booking.status}/><p className="text-xs text-gray-600">{booking.payment_status==='paid'?'Оплачено':booking.payment_status==='due'?'Оплата на приёме':'Ожидает оплаты'}</p></div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-5">
                                <Link className="rounded-xl border px-3 py-2 text-sm" href={`/admin/bookings?booking=${encodeURIComponent(booking.id)}`}>Карточка</Link>
                                {booking.status === "confirmed" && <button disabled={!!updatingId||!booking.slot_time||Date.parse(booking.slot_time)>Date.now()} onClick={() => setStatusConfirmation({id:booking.id,status:'completed',name:booking.client_name})} className="h-10 px-4 rounded-[var(--bs-radius-control)] bg-[var(--bs-primary)] text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"><Check className="w-4 h-4" />Завершить</button>}
                                {!['completed','cancelled'].includes(booking.status)&&<button disabled={!!updatingId} className="h-10 px-4 rounded-[var(--bs-radius-control)] border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-all" onClick={() => setStatusConfirmation({id:booking.id,status:'cancelled',name:booking.client_name})}>Отмена</button>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {slotDetails&&<AdminModal title="Свободное окно" onCancel={()=>setSlotDetails(null)}><div className="max-w-md rounded-[var(--bs-radius-control)] bg-[var(--bs-surface)] p-5"><h3 className="font-semibold">Свободное окно</h3><p className="mt-2 text-sm">{TYPE_LABELS[slotDetails.service_type]} · {format(slotDetails.slot_time,'dd.MM.yyyy HH:mm')} МСК · {slotDetails.duration_minutes} мин</p><p className="mt-2 text-xs text-gray-500">Альтернативное начало, не отдельный ресурс. Закрытие заблокирует все пересекающиеся услуги.</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={windowPending} className="min-h-11 rounded-xl bg-gray-900 px-4 text-sm text-white" onClick={()=>openNewBooking(slotDetails)}>Создать запись</button><button disabled={windowPending} className="min-h-11 rounded-xl border px-4 text-sm" onClick={closeWindow}>Закрыть окно</button><button disabled={windowPending} className="min-h-11 rounded-xl border px-4 text-sm" onClick={()=>{setSelectedDay(moscowDate(slotDetails.slot_time));setBreakFrom(format(slotDetails.slot_time,'HH:mm'));setSlotDetails(null);setShowBreakModal(true);}}>Добавить перерыв</button></div></div></AdminModal>}
      {breakDetails&&<AdminModal title="Детали ограничения" onCancel={()=>setBreakDetails(null)}><div className="max-w-md rounded-[var(--bs-radius-control)] bg-[var(--bs-surface)] p-5"><h3 className="font-semibold">{breakDetails.reason||'Перерыв'}</h3><p className="mt-2 text-sm">{format(breakDetails.starts_at,'dd.MM.yyyy HH:mm')} — {format(breakDetails.ends_at,'dd.MM.yyyy HH:mm')} МСК</p>{(!breakDetails.source_type||breakDetails.source_type==='manual')?<button disabled={!!deletingBreakId} className="mt-4 min-h-11 rounded-xl border px-4 text-sm" onClick={async()=>{await handleDeleteBreak(breakDetails.id);setBreakDetails(null);}}>Снять перерыв</button>:<p className="mt-3 text-xs">Ограничение управляется шаблоном, исключением или закрытием окна. Измените соответствующее правило в разделе «Время для записи».</p>}</div></AdminModal>}
      {statusConfirmation&&<AdminConfirmDialog title={statusConfirmation.status==='cancelled'?'Отменить запись?':'Подтвердить посещение?'} onCancel={()=>setStatusConfirmation(null)} onConfirm={()=>handleStatusChange(statusConfirmation.id,statusConfirmation.status)}><p>{statusConfirmation.name}</p><p className="mt-2 text-sm">{statusConfirmation.status==='cancelled'?'История сохраняется. Освободится только время, не заблокированное другими приёмами или перерывами. Банковский возврат не выполняется.':'Подтвердите фактически состоявшийся приём. Оплата учитывается отдельно.'}</p></AdminConfirmDialog>}
      {showAddModal && (
        <AdminModal title="Новая запись" presentation="panel" dismissDisabled={adding} onCancel={() => {setShowAddModal(false);setNewSlotId(null);setNewConsent(false);setNewAccountId(null);setNewIdentity(false);}}>
          <div className="healthcare-calendar-form healthcare-calendar-create w-full rounded-[var(--bs-radius-card)] bg-[var(--bs-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--bs-border)]">
              <div><h3 className="text-lg font-semibold text-[var(--bs-foreground)]">Новая запись</h3><p className="text-sm text-[var(--bs-muted)] mt-1">{format(selectedDay, "d MMMM yyyy", { locale: ru })}</p></div>
              <button type="button" disabled={adding} aria-label="Закрыть" onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-[var(--bs-radius-control)] hover:bg-gray-100 flex items-center justify-center transition-all"><X className="w-5 h-5 text-[var(--bs-muted)]" /></button>
            </div>
            <form onSubmit={handleAddBooking} className="healthcare-calendar-booking-form">
              <div className="healthcare-calendar-create-fields">
              <fieldset className="healthcare-calendar-fieldset" disabled={adding}>
              <legend>Клиент</legend>
              <SchedulingClientPicker onSelect={c=>{setNewAccountId(c?.id??null);setNewIdentity(false);if(c){setNewName(c.display_name??'');setNewPhone(formatRussianPhoneInput(c.phone??''));}}}/>
              {newAccountId&&<label className="flex gap-3 text-xs"><input required type="checkbox" checked={newIdentity} onChange={e=>setNewIdentity(e.target.checked)}/>Личность клиента и принадлежность кабинета подтверждены</label>}
              <div className="healthcare-calendar-client-row">
              <AdminField id="booking-client-name" label="Имя клиента"><AdminInput id="booking-client-name" autoComplete="name" required value={newName} onChange={e=>setNewName(e.target.value)} /></AdminField>
              <AdminField id="booking-client-phone" label="Телефон клиента"><AdminInput id="booking-client-phone" required type="tel" autoComplete="tel" inputMode="tel" placeholder="+7 (___) ___-__-__" value={newPhone} onChange={e=>setNewPhone(formatRussianPhoneInput(e.target.value))} /></AdminField>
              </div>
              </fieldset>
              <fieldset className="healthcare-calendar-fieldset" disabled={adding}>
              <legend>Приём</legend>
                <AdminField id="booking-service" label="Услуга"><AdminSelect id="booking-service" value={newService} onChange={e=>{setNewService(e.target.value as ServiceType);setNewSlotId(null);}}>{SERVICE_TYPES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</AdminSelect></AdminField>
              <div className="healthcare-calendar-form-row grid grid-cols-2 gap-3">
              <AdminField id="booking-date" label="Дата приёма"><AdminInput id="booking-date" required type="date" value={format(selectedDay,'yyyy-MM-dd')} onChange={e=>{if(e.target.value&&/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){const date=moscowDate(`${e.target.value}T12:00:00+03:00`);if(Number.isFinite(date.getTime())){setSelectedDay(date);setCurrentMonth(date);setNewSlotId(null);}}}}/></AdminField>
                <AdminField id="booking-time" label="Время (МСК)"><AdminInput id="booking-time" type="time" value={newTime} onChange={e=>{setNewTime(e.target.value);setNewSlotId(null);}} /></AdminField>
              </div>
              <p className="healthcare-calendar-helper">{newSlotId?'Выбрано свободное окно из календаря.':'Время указано по Москве. Доступность проверяется при сохранении записи.'}</p>
              </fieldset>
              <fieldset className="healthcare-calendar-fieldset" disabled={adding}>
              <legend>Подтверждение</legend>
              <label className="flex items-start gap-3 text-xs text-gray-700"><input type="checkbox" required checked={newConsent} onChange={e=>setNewConsent(e.target.checked)}/>Клиент дал согласие на обработку данных и запись на услугу.</label>
              </fieldset>
              <AdminButton variant="outline" disabled={adding} onClick={addWindowOnly} className="w-full">Добавить только окно, без клиента</AdminButton>
              </div>
              <footer className="healthcare-calendar-create-actions">
              <AdminButton variant="outline" disabled={adding} onClick={() => {setShowAddModal(false);setNewSlotId(null);setNewConsent(false);setNewAccountId(null);setNewIdentity(false);}}>Отмена</AdminButton>
              <AdminButton type="submit" loading={adding} disabled={!newConsent} className="w-full">{adding ? 'Добавление…' : 'Создать запись'}</AdminButton>
              </footer>
            </form>
          </div>
        </AdminModal>
      )}

      {showBreakModal && (
        <AdminModal title="Новый перерыв" dismissDisabled={savingBreak} onCancel={() => setShowBreakModal(false)}>
          <div className="healthcare-calendar-form w-full max-w-md rounded-[var(--bs-radius-card)] bg-[var(--bs-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--bs-border)]">
              <div><h3 className="text-lg font-semibold text-[var(--bs-foreground)]">Новый перерыв</h3><p className="text-sm text-[var(--bs-muted)] mt-1">{format(selectedDay, "d MMMM yyyy", { locale: ru })}</p></div>
              <button disabled={savingBreak} onClick={() => setShowBreakModal(false)} className="w-10 h-10 rounded-[var(--bs-radius-control)] hover:bg-gray-100 flex items-center justify-center transition-all" aria-label="Закрыть"><X className="w-5 h-5 text-[var(--bs-muted)]" /></button>
            </div>
            <form onSubmit={handleAddBreak} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-[var(--bs-muted)]">Начало<input required type="time" value={breakFrom} onChange={(e) => setBreakFrom(e.target.value)} className="mt-1 h-12 w-full rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="text-xs font-medium text-[var(--bs-muted)]">Окончание<input required type="time" value={breakTo} onChange={(e) => setBreakTo(e.target.value)} className="mt-1 h-12 w-full rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
              </div>
              <label className="block text-xs font-medium text-[var(--bs-muted)]">Причина<input value={breakReason} maxLength={200} onChange={(e) => setBreakReason(e.target.value)} placeholder="Например: стоматолог" className="mt-1 h-12 w-full rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
              <p className="rounded-[var(--bs-radius-control)] bg-violet-50 p-4 text-xs leading-5 text-violet-700">Все пересекающиеся слоты автоматически станут недоступны для записи.</p>
              <button type="submit" disabled={savingBreak} className="w-full h-12 rounded-[var(--bs-radius-control)] bg-violet-700 text-white text-sm font-medium hover:bg-violet-800 transition-all disabled:opacity-50">{savingBreak ? "Добавление..." : "Добавить перерыв"}</button>
            </form>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
