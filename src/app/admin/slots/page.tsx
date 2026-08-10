"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Trash2, RefreshCw, Calendar, Eye, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";

interface Slot {
  id: string;
  service_type: string;
  slot_time: string;
  is_booked: boolean;
}

const SERVICE_TYPES = [
  { value: "bfm", label: "БФМ", color: "border-l-amber-400 bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  { value: "brt", label: "БРТ", color: "border-l-emerald-400 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  { value: "psychology", label: "Психология", color: "border-l-sky-400 bg-sky-50", badge: "bg-sky-100 text-sky-700" },
];

const PRESETS = [
  { label: "Рабочий день", from: "09:00", to: "18:00", step: 60 },
  { label: "Утро", from: "08:00", to: "12:00", step: 40 },
  { label: "Вечер", from: "16:00", to: "20:00", step: 60 },
];

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "timeline">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"selected" | "all_free">("selected");
  const [deleting, setDeleting] = useState(false);
  const [filterFree, setFilterFree] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState("bfm");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("18:00");
  const [step, setStep] = useState(60);
  const [showPreview, setShowPreview] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/slots/list");
      const data = await res.json();
      setSlots(data.slots || []);
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
      for (let t = hFrom * 60 + mFrom; t <= hTo * 60 + mTo; t += step) {
        slots.push({
          date: format(current, "dd.MM"),
          time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
        });
      }
      current = addDays(current, 1);
    }
    return slots;
  }, [dateFrom, dateTo, timeFrom, timeTo, step]);

  const handleCreate = async () => {
    if (!dateFrom) return;
    const start = new Date(dateFrom);
    const end = dateTo ? new Date(dateTo) : new Date(dateFrom);
    const [hFrom, mFrom] = timeFrom.split(":").map(Number);
    const [hTo, mTo] = timeTo.split(":").map(Number);
    const slotsToCreate: any[] = [];
    let current = new Date(start);
    while (current <= end) {
      for (let t = hFrom * 60 + mFrom; t <= hTo * 60 + mTo; t += step) {
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
      for (const type of SERVICE_TYPES) {
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

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (selected.size === freeSlots.length) setSelected(new Set()); else setSelected(new Set(freeSlots.map((s) => s.id))); };
  const applyPreset = (p: typeof PRESETS[0]) => { setTimeFrom(p.from); setTimeTo(p.to); setStep(p.step); };

  const stats = { total: futureSlots.length, free: futureSlots.filter((s) => !s.is_booked).length, booked: futureSlots.filter((s) => s.is_booked).length };
  const daysCount = useMemo(() => {
    if (!dateFrom) return 1;
    if (!dateTo) return 1;
    return Math.max(1, differenceInDays(new Date(dateTo), new Date(dateFrom)) + 1);
  }, [dateFrom, dateTo]);

  const grouped = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    filtered.forEach((s) => { const day = format(parseISO(s.slot_time), "d MMMM, EEEE", { locale: ru }); if (!groups[day]) groups[day] = []; groups[day].push(s); });
    return groups;
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="sticky top-0 z-20 bg-[#F6F5F2]/90 backdrop-blur-md pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-[#111827]">Слоты</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "list" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>Список</button>
              <button onClick={() => setView("timeline")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === "timeline" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280]"}`}>Timeline</button>
            </div>
            <button onClick={fetchSlots} className="p-2 rounded-xl hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-[#6B7280]" /></button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[{ label: "Всего", value: stats.total }, { label: "Свободно", value: stats.free }, { label: "Занято", value: stats.booked }].map((s) => (
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

      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6 shadow-sm">
        <h3 className="font-semibold text-[#111827] mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Создать слоты</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="h-10 rounded-xl border px-3 text-sm">
            {SERVICE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (!dateTo) setDateTo(e.target.value); }} className="h-10 rounded-xl border px-3 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl border px-3 text-sm" />
          <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="h-10 rounded-xl border px-3 text-sm" />
          <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="h-10 rounded-xl border px-3 text-sm" />
          <select value={step} onChange={(e) => setStep(Number(e.target.value))} className="h-10 rounded-xl border px-3 text-sm">
            <option value={30}>30 мин</option><option value={40}>40 мин</option><option value={50}>50 мин</option>
            <option value={60}>60 мин</option><option value={90}>90 мин</option><option value={120}>120 мин</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {PRESETS.map((p) => (<button key={p.label} onClick={() => applyPreset(p)} className="px-3 py-1.5 rounded-full text-xs bg-gray-100 hover:bg-gray-200 text-[#6B7280] transition-colors">{p.label}</button>))}
        </div>
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
                    <div key={slot.id} className={`flex items-center justify-between p-2.5 rounded-xl border-l-4 text-sm transition-all ${slot.is_booked ? "bg-gray-50 border-l-gray-300 opacity-60" : selected.has(slot.id) ? "bg-teal-50 border-l-teal-400 ring-2 ring-teal-300" : `${type?.color} bg-white hover:shadow-sm`}`}>
                      <div className="flex items-center gap-2">
                        {!slot.is_booked && <input type="checkbox" checked={selected.has(slot.id)} onChange={() => toggleSelect(slot.id)} className="w-3.5 h-3.5 rounded" />}
                        <span className="font-medium">{format(parseISO(slot.slot_time), "HH:mm")}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${type?.badge}`}>{type?.label}</span>
                      </div>
                      <span className={`text-xs ${slot.is_booked ? "text-red-500" : "text-green-600"}`}>{slot.is_booked ? "Занят" : "Свободен"}</span>
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
