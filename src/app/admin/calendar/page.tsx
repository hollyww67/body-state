"use client";
import { AdminModal } from "@/components/admin/AdminConfirmDialog";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Check,
  Clock3, CalendarDays, Search, X, Phone, Coffee, Trash2,
} from "lucide-react";
import type { Booking, BookingStatus, ServiceType } from "@/lib/api/bookings";
import { getBookings, patchBooking, TYPE_LABELS } from "@/lib/api/bookings";
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
}

export default function AdminCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [scheduleBreaks, setScheduleBreaks] = useState<ScheduleBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<ServiceType | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newTime, setNewTime] = useState("10:00"); const [adding, setAdding] = useState(false);
  const [breakFrom, setBreakFrom] = useState("12:00");
  const [breakTo, setBreakTo] = useState("13:00");
  const [breakReason, setBreakReason] = useState("");
  const [savingBreak, setSavingBreak] = useState(false);
  const [deletingBreakId, setDeletingBreakId] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingData, breaksResponse] = await Promise.all([getBookings(), fetch("/api/admin/schedule-breaks")]);
      const breaksData = await breaksResponse.json();
      if (!breaksResponse.ok) throw new Error(breaksData.error || "Не удалось загрузить перерывы");
      setBookings(bookingData);
      setScheduleBreaks(breaksData.breaks || []);
    }
    catch { toast.error("Не удалось загрузить календарь"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCalendar(); const i = setInterval(fetchCalendar, 30000); return () => clearInterval(i); }, [fetchCalendar]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase();
      return (!q || b.client_name?.toLowerCase().includes(q) || b.client_phone?.includes(q)) &&
        (selectedType === "all" || b.service_type === selectedType);
    });
  }, [bookings, search, selectedType]);

  const handleStatusChange = async (id: string, status: BookingStatus) => {
    const prev = bookings; setUpdatingId(id);
    setBookings((p) => p.filter((b) => b.id !== id));
    try { await patchBooking(id, status); } catch (error) { setBookings(prev); toast.error(error instanceof Error ? error.message : 'Не удалось обновить запись'); } finally { setUpdatingId(null); }
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true);
    try {
      const slotTime = new Date(selectedDay); const [h, m] = newTime.split(":").map(Number);
      slotTime.setHours(h, m, 0, 0);

      const bookingRes = await fetch("/api/admin/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_type: newService, slot_time: slotTime.toISOString(), client_name: newName, client_phone: newPhone, consent_confirmed: true }),
      });
      const result = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(result.error || "Не удалось создать запись");
      setShowAddModal(false); setNewName(""); setNewPhone(""); setNewTime("10:00"); await fetchCalendar(); toast.success("Запись создана");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать запись");
    } finally { setAdding(false); }
  };

  const handleAddBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    const date = format(selectedDay, "yyyy-MM-dd");
    const startsAt = new Date(`${date}T${breakFrom}:00`);
    const endsAt = new Date(`${date}T${breakTo}:00`);
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
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);
    return scheduleBreaks.filter((item) => parseISO(item.starts_at) < dayEnd && parseISO(item.ends_at) > dayStart)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  };

  const selectedBookings = getDayBookings(selectedDay);
  const selectedBreaks = getDayBreaks(selectedDay);
  const stats = {
    today: getDayBookings(new Date()).length,
    total: filteredBookings.length,
    completed: bookings.filter((b) => b.status === "completed").length,
    week: filteredBookings.filter((b) => { if (!b.slot_time) return false; const d = parseISO(b.slot_time); return d >= new Date() && d <= addDays(new Date(), 7); }).length,
  };

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="admin-calendar-page min-h-screen bg-[#F5F7FA]">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div><h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Календарь записей</h1><p className="text-sm text-[#6B7280] mt-1">Управление клиентскими записями</p></div>
            <div className="admin-mobile-toolbar flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-[280px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск клиента..." className="w-full h-11 rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" /></div>
              <div className="admin-mobile-scroll flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-1">
                <button onClick={() => setSelectedType("all")} className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${selectedType === "all" ? "bg-[#111827] text-white" : "text-[#6B7280]"}`}>Все</button>
                {SERVICE_TYPES.map((s) => (<button key={s.value} onClick={() => setSelectedType(s.value)} className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${selectedType === s.value ? "bg-[#111827] text-white" : "text-[#6B7280]"}`}>{s.label}</button>))}
              </div>
              <button onClick={fetchCalendar} className="h-11 px-4 rounded-2xl border border-gray-200 bg-white flex items-center gap-2 text-sm font-medium hover:bg-gray-50 transition-all"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />Обновить</button>
            </div>
          </div>
          <div className="admin-mobile-stats grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
            <StatCard title="Сегодня" value={stats.today} /><StatCard title="На неделе" value={stats.week} /><StatCard title="Всего записей" value={stats.total} /><StatCard title="Завершено" value={stats.completed} />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_420px] gap-6 items-start">
          <div className="admin-calendar-grid-card bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="admin-calendar-header flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="w-11 h-11 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronLeft className="w-5 h-5 text-[#6B7280]" /></button>
                <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="w-11 h-11 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronRight className="w-5 h-5 text-[#6B7280]" /></button>
              </div>
              <div className="text-center"><h2 className="text-xl font-semibold text-[#111827] capitalize">{format(currentMonth, "LLLL yyyy", { locale: ru })}</h2><p className="text-sm text-[#6B7280] mt-1">{filteredBookings.length} записей</p></div>
              <button onClick={() => setCurrentMonth(new Date())} className="h-11 px-4 rounded-2xl bg-[#111827] text-white text-sm font-medium hover:opacity-90 transition-all">Сегодня</button>
            </div>
            <div className="grid grid-cols-7 px-4 pt-4">{weekDays.map((d) => (<div key={d} className="h-12 flex items-center justify-center text-sm font-medium text-[#6B7280]">{d}</div>))}</div>
            <div className="admin-calendar-days grid grid-cols-7 gap-2 p-4">
              {days.map((d) => {
                const dayBookings = getDayBookings(d);
                const dayBreaks = getDayBreaks(d);
                const isCurrent = isSameMonth(d, currentMonth);
                const isSelected = isSameDay(d, selectedDay);
                const isToday = isSameDay(d, new Date());
                const density = dayBookings.length >= 6 ? "bg-teal-100" : dayBookings.length >= 4 ? "bg-teal-50" : "";
                return (
                  <button key={d.toISOString()} onClick={() => setSelectedDay(d)}
                    className={`admin-calendar-day relative min-h-[120px] rounded-3xl border p-3 text-left transition-all overflow-hidden ${!isCurrent ? "opacity-30" : "hover:shadow-lg hover:-translate-y-0.5"} ${isSelected ? "border-teal-300 bg-teal-50 ring-2 ring-teal-500/20 shadow-lg" : "border-gray-100 bg-white"} ${density}`}>
                    {isToday && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-teal-500 animate-pulse" />}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-semibold ${isToday ? "text-teal-700" : "text-[#111827]"}`}>{format(d, "d")}</span>
                      {dayBookings.length > 0 && <div className="px-2 py-1 rounded-full bg-[#111827] text-white text-[11px] font-medium">{dayBookings.length}</div>}
                    </div>
                    <div className="space-y-1.5">
                      {dayBookings.slice(0, 3).map((b) => {
                        const service = SERVICE_TYPES.find((s) => s.value === b.service_type);
                        return (<div key={b.id} className="flex items-center gap-1.5 text-[11px]"><div className={`w-1.5 h-1.5 rounded-full ${service?.color}`} /><span className="truncate text-[#374151]">{b.slot_time ? format(parseISO(b.slot_time), "HH:mm") : ""}</span></div>);
                      })}
                      {dayBookings.length > 3 && <div className="text-[11px] text-[#6B7280]">+{dayBookings.length - 3}</div>}
                      {dayBreaks.length > 0 && <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700"><Coffee className="h-3 w-3" /><span className="truncate">{dayBreaks.length === 1 ? dayBreaks[0].reason || "Перерыв" : `Перерывов: ${dayBreaks.length}`}</span></div>}
                    </div>
                    <span aria-hidden="true" className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-xl border border-gray-200 bg-white shadow-sm"><Plus className="w-3.5 h-3.5" /></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-calendar-detail sticky top-28">
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold text-[#111827]">{format(selectedDay, "d MMMM, EEEE", { locale: ru })}</h3><p className="text-sm text-[#6B7280] mt-1">{selectedBookings.length} записей · {selectedBreaks.length} перерывов</p></div>
                  <div className="flex flex-wrap justify-end gap-2"><button onClick={() => setShowBreakModal(true)} className="h-11 px-3 rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 flex items-center gap-2 text-sm font-medium hover:bg-violet-100 transition-all"><Coffee className="w-4 h-4" />Перерыв</button><button onClick={() => setShowAddModal(true)} className="h-11 px-3 rounded-2xl bg-[#111827] text-white flex items-center gap-2 text-sm font-medium hover:opacity-90 transition-all"><Plus className="w-4 h-4" />Запись</button></div>
                </div>
              </div>
              <div className="max-h-[760px] overflow-y-auto p-6">
                {loading ? (
                  <div className="space-y-3">{[...Array(6)].map((_, i) => (<div key={i} className="h-28 rounded-3xl bg-gray-100 animate-pulse" />))}</div>
                ) : selectedBookings.length === 0 && selectedBreaks.length === 0 ? (
                  <div className="text-center py-20"><div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><CalendarDays className="w-6 h-6 text-[#9CA3AF]" /></div><h4 className="font-semibold text-[#111827]">Нет событий</h4><p className="text-sm text-[#6B7280] mt-1">Добавьте запись или перерыв</p></div>
                ) : (
                  <div className="space-y-4">
                    {selectedBreaks.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white"><Coffee className="h-5 w-5" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div><h4 className="font-semibold text-violet-950">{item.reason || "Перерыв"}</h4><p className="mt-1 text-sm text-violet-700">{format(parseISO(item.starts_at), "d MMM, HH:mm", { locale: ru })} — {format(parseISO(item.ends_at), "d MMM, HH:mm", { locale: ru })}</p></div>
                              <button type="button" onClick={() => handleDeleteBreak(item.id)} disabled={deletingBreakId === item.id} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-violet-600 hover:bg-violet-100 disabled:opacity-50" aria-label="Удалить перерыв"><Trash2 className="h-4 w-4" /></button>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-violet-700">Запись на пересекающееся время недоступна для всех услуг.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedBookings.map((booking) => {
                      const service = SERVICE_TYPES.find((s) => s.value === booking.service_type);
                      return (
                        <div key={booking.id} className="relative rounded-3xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-lg transition-all">
                          <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-100" />
                          <div className="relative flex gap-4">
                            <div className="relative z-10 shrink-0">
                              <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${service?.color}`}><Clock3 className="w-4 h-4 mb-1" /><span className="text-xs font-semibold">{booking.slot_time ? format(parseISO(booking.slot_time), "HH:mm") : ""}</span></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap"><h4 className="font-semibold text-[#111827]">{booking.client_name}</h4><span className={`px-2 py-1 rounded-full border text-[11px] font-medium ${service?.bg}`}>{TYPE_LABELS[booking.service_type]}</span></div>
                                  <div className="flex items-center gap-2 mt-2 text-sm text-[#6B7280]"><Phone className="w-3.5 h-3.5" /><span>{booking.client_phone}</span></div>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-[11px] font-medium border ${booking.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}`}>{booking.status === "pending" ? "Ждёт оплаты" : "Оплачена"}</div>
                              </div>
                              <div className="flex items-center gap-2 mt-5">
                                {booking.status === "confirmed" && <button disabled={updatingId === booking.id} onClick={() => handleStatusChange(booking.id, "completed")} className="h-10 px-4 rounded-2xl bg-[#111827] text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"><Check className="w-4 h-4" />Завершить</button>}
                                <button className="h-10 px-4 rounded-2xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-all" onClick={() => handleStatusChange(booking.id, "cancelled")}>Отмена</button>
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

      {showAddModal && (
        <AdminModal title="Новая запись" onCancel={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-[32px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div><h3 className="text-lg font-semibold text-[#111827]">Новая запись</h3><p className="text-sm text-[#6B7280] mt-1">{format(selectedDay, "d MMMM yyyy", { locale: ru })}</p></div>
              <button type="button" aria-label="Закрыть" onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-2xl hover:bg-gray-100 flex items-center justify-center transition-all"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <form onSubmit={handleAddBooking} className="p-6 space-y-4">
              <input required placeholder="Имя клиента" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              <input required type="tel" inputMode="tel" placeholder="+7 (___) ___-__-__" value={newPhone} onChange={(e) => setNewPhone(formatRussianPhoneInput(e.target.value))} className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newService} onChange={(e) => setNewService(e.target.value as ServiceType)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all bg-white">{SERVICE_TYPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}</select>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              </div>
              <button type="submit" disabled={adding} className="w-full h-12 rounded-2xl bg-[#111827] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">{adding ? "Добавление..." : "Добавить запись"}</button>
            </form>
          </div>
        </AdminModal>
      )}

      {showBreakModal && (
        <AdminModal title="Новый перерыв" onCancel={() => setShowBreakModal(false)}>
          <div className="w-full max-w-md rounded-[32px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div><h3 className="text-lg font-semibold text-[#111827]">Новый перерыв</h3><p className="text-sm text-[#6B7280] mt-1">{format(selectedDay, "d MMMM yyyy", { locale: ru })}</p></div>
              <button onClick={() => setShowBreakModal(false)} className="w-10 h-10 rounded-2xl hover:bg-gray-100 flex items-center justify-center transition-all" aria-label="Закрыть"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <form onSubmit={handleAddBreak} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-[#6B7280]">Начало<input required type="time" value={breakFrom} onChange={(e) => setBreakFrom(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
                <label className="text-xs font-medium text-[#6B7280]">Окончание<input required type="time" value={breakTo} onChange={(e) => setBreakTo(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
              </div>
              <label className="block text-xs font-medium text-[#6B7280]">Причина<input value={breakReason} maxLength={200} onChange={(e) => setBreakReason(e.target.value)} placeholder="Например: стоматолог" className="mt-1 h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
              <p className="rounded-2xl bg-violet-50 p-4 text-xs leading-5 text-violet-700">Все пересекающиеся слоты автоматически станут недоступны для записи.</p>
              <button type="submit" disabled={savingBreak} className="w-full h-12 rounded-2xl bg-violet-700 text-white text-sm font-medium hover:bg-violet-800 transition-all disabled:opacity-50">{savingBreak ? "Добавление..." : "Добавить перерыв"}</button>
            </form>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-[#6B7280]">{title}</p>
      <h3 className="text-3xl font-bold tracking-tight text-[#111827] mt-2">{value}</h3>
    </div>
  );
}
