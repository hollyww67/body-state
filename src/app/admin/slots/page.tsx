"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Trash2, RefreshCw, Calendar, Eye, AlertTriangle, Layers, Coffee, Clock3 } from "lucide-react";
import { toast } from "sonner";

interface Slot {
  id: string;
  service_type: string;
  slot_time: string;
  is_booked: boolean;
  is_break?: boolean;
}

interface ScheduleBreak {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
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
  const [slots, setSlots] = useState<Slot[]>([]);
  const [scheduleBreaks, setScheduleBreaks] = useState<ScheduleBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "timeline">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"selected" | "all_free">("selected");
  const [deleting, setDeleting] = useState(false);
  const [filterFree, setFilterFree] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState("bfm");
  const [dateFrom, setDateFrom] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("09:30");
  const [timeTo, setTimeTo] = useState("18:30");
  const [step, setStep] = useState(90);
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5, 6]));
  const [showPreview, setShowPreview] = useState(false);
  const [breakDate, setBreakDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  const [breakReason, setBreakReason] = useState("");
  const [savingBreak, setSavingBreak] = useState(false);
  const [deletingBreakId, setDeletingBreakId] = useState<string | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const [slotsResponse, breaksResponse] = await Promise.all([fetch("/api/admin/slots/list"), fetch("/api/admin/schedule-breaks")]);
      const [data, breaksData] = await Promise.all([slotsResponse.json(), breaksResponse.json()]);
      if (!slotsResponse.ok) throw new Error(data.error || "Не удалось загрузить слоты");
      if (!breaksResponse.ok) throw new Error(breaksData.error || "Не удалось загрузить перерывы");
      setSlots(data.slots || []);
      setScheduleBreaks(breaksData.breaks || []);
      setSelected(new Set());
    } catch { toast.error("Ошибка загрузки"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchSlots(); }, []);

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
  const allFreeSlots = useMemo(() => futureSlots.filter((s) => !s.is_booked), [futureSlots]);

  const previewSlots = useMemo(() => {
    if (!dateFrom) return [];
    const slots: { date: string; time: string }[] = [];
    const [hFrom, mFrom] = timeFrom.split(":").map(Number);
    const [hTo, mTo] = timeTo.split(":").map(Number);
    const start = new Date(dateFrom);
    const end = dateTo ? new Date(dateTo) : new Date(dateFrom);
    if (end < start) return [];
    let current = new Date(start);
    while (current <= end) {
      if (weekdays.has(current.getDay())) for (let t = hFrom * 60 + mFrom; t <= hTo * 60 + mTo; t += step) {
        slots.push({
          date: format(current, "dd.MM"),
          time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
        });
      }
      current = addDays(current, 1);
    }
    return slots;
  }, [dateFrom, dateTo, timeFrom, timeTo, step, weekdays]);

  const handleCreate = async () => {
    if (!dateFrom) return;
    const start = new Date(dateFrom);
    const end = dateTo ? new Date(dateTo) : new Date(dateFrom);
    const [hFrom, mFrom] = timeFrom.split(":").map(Number);
    const [hTo, mTo] = timeTo.split(":").map(Number);
    const slotsToCreate: any[] = [];
    let current = new Date(start);
    while (current <= end) {
      if (weekdays.has(current.getDay())) for (let t = hFrom * 60 + mFrom; t <= hTo * 60 + mTo; t += step) {
        slotsToCreate.push({
          service_type: serviceType,
          slot_time: new Date(`${format(current, "yyyy-MM-dd")}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00`).toISOString(),
        });
      }
      current = addDays(current, 1);
    }
    try {
      const res = await fetch("/api/admin/slots/batch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: slotsToCreate }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Создано слотов: ${data.count}`); fetchSlots(); setShowPreview(false); }
      else toast.error(data.error || "Ошибка");
    } catch { toast.error("Ошибка сети"); }
  };

  const handleCreateAll = async () => {
    if (!dateFrom) return;
    const start = new Date(dateFrom);
    const end = dateTo ? new Date(dateTo) : new Date(dateFrom);
    const [hFrom, mFrom] = timeFrom.split(":").map(Number);
    const [hTo, mTo] = timeTo.split(":").map(Number);
    const allSlots: any[] = [];
    let current = new Date(start);
    while (current <= end) {
      if (weekdays.has(current.getDay())) for (const type of SERVICE_TYPES) {
        for (let t = hFrom * 60 + mFrom; t <= hTo * 60 + mTo; t += step) {
          allSlots.push({
            service_type: type.value,
            slot_time: new Date(`${format(current, "yyyy-MM-dd")}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00`).toISOString(),
          });
        }
      }
      current = addDays(current, 1);
    }
    try {
      const res = await fetch("/api/admin/slots/batch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: allSlots }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Создано слотов: ${data.count} (все направления)`); fetchSlots(); setShowPreview(false); }
      else toast.error(data.error || "Ошибка");
    } catch { toast.error("Ошибка сети"); }
  };

  const deleteSelected = async () => {
    const ids = deleteMode === "all_free" ? allFreeSlots.map(s => s.id) : [...selected];
    if (ids.length === 0) return;
    
    setDeleting(true);
    setShowConfirm(false);
    
    try {
      const res = await fetch("/api/admin/slots/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Удалено слотов: ${data.count || ids.length}`);
        fetchSlots();
      } else {
        toast.error(data.error || "Ошибка удаления");
        fetchSlots();
      }
    } catch {
      toast.error("Ошибка сети");
      fetchSlots();
    } finally {
      setDeleting(false);
    }
  };

  const createBreak = async () => {
    if (!breakDate || !breakFrom || !breakTo) return toast.error("Укажите дату и время перерыва");
    const startsAt = new Date(`${breakDate}T${breakFrom}:00`);
    const endsAt = new Date(`${breakDate}T${breakTo}:00`);
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
  const setNextMonth = () => { setDateFrom(format(addDays(new Date(), 1), "yyyy-MM-dd")); setDateTo(format(addDays(new Date(), 30), "yyyy-MM-dd")); };

  const stats = { total: futureSlots.length, free: futureSlots.filter((s) => !s.is_booked).length, booked: futureSlots.filter((s) => s.is_booked && !s.is_break).length, breaks: scheduleBreaks.length };
  const daysCount = useMemo(() => {
    if (!dateFrom) return 1;
    if (!dateTo) return 1;
    return Math.max(1, differenceInDays(new Date(dateTo), new Date(dateFrom)) + 1);
  }, [dateFrom, dateTo]);

  const grouped = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    filtered.forEach((s) => { const day = format(parseISO(s.slot_time), "d MMMM yyyy, EEEE", { locale: ru }); if (!groups[day]) groups[day] = []; groups[day].push(s); });
    return groups;
  }, [filtered]);

  return (
    <div className="admin-slots-page max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 bg-[#F6F5F2]/90 backdrop-blur-md pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#111827]">Доступное время</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "list" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>Список</button>
              <button onClick={() => setView("timeline")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "timeline" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>По времени</button>
            </div>
            <button onClick={fetchSlots} aria-label="Обновить расписание" className="p-2 rounded-xl hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-[#6B7280]" /></button>
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
          {allFreeSlots.length > 0 && (
            <button onClick={() => { setDeleteMode("all_free"); setShowConfirm(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">
              <Trash2 className="w-3 h-3" /> Удалить все свободные ({allFreeSlots.length})
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Coffee className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#111827]">Добавить перерыв</h3><p className="mt-1 text-xs leading-5 text-[#6B7280]">Перерыв закроет для записи все пересекающиеся окна во всех направлениях.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <label className="text-xs font-medium text-[#6B7280]">Дата<input type="date" value={breakDate} min={format(new Date(), "yyyy-MM-dd")} onChange={(event) => setBreakDate(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">С<input type="time" value={breakFrom} onChange={(event) => setBreakFrom(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">До<input type="time" value={breakTo} onChange={(event) => setBreakTo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <label className="text-xs font-medium text-[#6B7280]">Причина<input value={breakReason} maxLength={200} onChange={(event) => setBreakReason(event.target.value)} placeholder="Например: стоматолог" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm text-[#111827]" /></label>
          <button type="button" onClick={createBreak} disabled={savingBreak} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />{savingBreak ? "Добавляем…" : "Добавить"}</button>
        </div>
        {scheduleBreaks.length > 0 && <div className="mt-5 grid gap-2 md:grid-cols-2">{scheduleBreaks.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3"><Clock3 className="h-4 w-4 shrink-0 text-violet-700" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#111827]">{format(parseISO(item.starts_at), "d MMMM, HH:mm", { locale: ru })}–{format(parseISO(item.ends_at), "HH:mm")}</p><p className="truncate text-xs text-[#6B7280]">{item.reason || "Перерыв"}</p></div><button type="button" onClick={() => removeBreak(item.id)} disabled={deletingBreakId === item.id} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-100 disabled:opacity-50" aria-label={`Удалить перерыв ${item.reason}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6 shadow-sm">
        <h3 className="font-semibold text-[#111827] mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Открыть время для записи</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <label className="grid gap-2 text-xs">Направление<select value={serviceType} onChange={(e) => { const value = e.target.value; setServiceType(value); setStep(value === "brt" ? 60 : 90); }} className="h-10 w-full rounded-xl border px-3 text-sm">
            {SERVICE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select></label>
          <label className="grid gap-2 text-xs">С даты<input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (!dateTo) setDateTo(e.target.value); }} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">По дату включительно<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">Начало рабочего дня<input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
          <label className="grid gap-2 text-xs">Последнее начало приёма<input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" /></label>
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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors text-[#111827]"><Eye className="w-4 h-4" /> Предпросмотр</button>
          <button onClick={handleCreate} disabled={!dateFrom} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}><Plus className="w-4 h-4" /> Создать ({previewSlots.length})</button>
          <button onClick={handleCreateAll} disabled={!dateFrom} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition-all">
            <Layers className="w-4 h-4" /> На все направления ({previewSlots.length * 3})
          </button>
        </div>
        {showPreview && previewSlots.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
            <p className="text-sm font-medium text-[#111827] mb-2">Будет создано {previewSlots.length} слотов • {daysCount} дн. • {SERVICE_TYPES.find(t=>t.value===serviceType)?.label}</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {previewSlots.map((s, i) => (<span key={i} className="px-2.5 py-1 rounded-lg bg-white border text-xs font-mono text-[#6B7280]">{s.date} {s.time}</span>))}
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
            <h3 className="text-lg font-semibold text-[#111827] mb-2">Удалить {deleteMode === "all_free" ? allFreeSlots.length : selected.size} слотов?</h3>
            <p className="text-sm text-[#6B7280] mb-6">Это действие нельзя отменить.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors">Отмена</button>
              <button onClick={deleteSelected} disabled={deleting} className="flex-1 py-2.5 rounded-full text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">{deleting ? "Удаление..." : "Удалить"}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => (<div key={i} className="h-20 rounded-2xl bg-white border border-gray-100 animate-pulse" />))}</div>
      ) : Object.keys(grouped).length === 0 ? (
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
                        {!slot.is_booked && <input type="checkbox" checked={selected.has(slot.id)} onChange={() => toggleSelect(slot.id)} className="w-3.5 h-3.5 rounded" />}
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
    </div>
  );
}
