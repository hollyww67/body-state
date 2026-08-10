"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, RefreshCw, Plus, Check,
  Clock3, CalendarDays, Search, X, Phone,
} from "lucide-react";
import type { Booking, BookingStatus, ServiceType } from "@/lib/api/bookings";
import { getBookings, patchBooking, TYPE_LABELS } from "@/lib/api/bookings";

const SERVICE_TYPES: { value: ServiceType; label: string; color: string; bg: string }[] = [
  { value: "bfm", label: "БФМ", color: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "brt", label: "БРТ", color: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "psychology", label: "Психология", color: "bg-sky-500", bg: "bg-sky-50 text-sky-700 border-sky-200" },
];

export default function AdminCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<ServiceType | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newTime, setNewTime] = useState("10:00"); const [adding, setAdding] = useState(false);

  const fetchBookings = useCallback(async () => {
    try { setLoading(true); const data = await getBookings(); setBookings(data.filter((b) => b.status === "confirmed")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); const i = setInterval(fetchBookings, 30000); return () => clearInterval(i); }, [fetchBookings]);

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
    try { await patchBooking(id, status); } catch { setBookings(prev); } finally { setUpdatingId(null); }
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true);
    try {
      const slotTime = new Date(selectedDay); const [h, m] = newTime.split(":").map(Number);
      slotTime.setHours(h, m, 0, 0);

      // Создаём слот
      const slotRes = await fetch("/api/admin/slots/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: [{ service_type: newService, slot_time: slotTime.toISOString() }] }),
      });
      if (!slotRes.ok) { setAdding(false); return; }

      // Ждём и получаем список слотов
      await new Promise((r) => setTimeout(r, 500));
      const listRes = await fetch("/api/admin/slots/list");
      const listData = await listRes.json();
      const allSlots = listData.slots || [];
      const createdSlot = allSlots.find((s: any) => {
        if (s.service_type !== newService || s.is_booked) return false;
        const sd = new Date(s.slot_time);
        return sd.getFullYear() === slotTime.getFullYear() && sd.getMonth() === slotTime.getMonth() &&
          sd.getDate() === slotTime.getDate() && sd.getHours() === slotTime.getHours() && sd.getMinutes() === slotTime.getMinutes();
      }) || allSlots.filter((s: any) => s.service_type === newService && !s.is_booked).sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      if (!createdSlot) { setAdding(false); return; }

      const bookingRes = await fetch(`/api/book/${newService}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: createdSlot.id, client_name: newName, client_phone: newPhone }),
      });
      if (bookingRes.ok) {
        const bookingData = await bookingRes.json();
        if (bookingData.booking?.id) await patchBooking(bookingData.booking.id, "confirmed");
      }
      setShowAddModal(false); setNewName(""); setNewPhone(""); setNewTime("10:00"); fetchBookings();
    } finally { setAdding(false); }
  };

  const monthStart = startOfMonth(currentMonth); const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = []; let day = calStart;
  while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

  const getDayBookings = (d: Date) => {
    return filteredBookings.filter((b) => b.slot_time && isSameDay(parseISO(b.slot_time), d))
      .sort((a, b) => new Date(a.slot_time!).getTime() - new Date(b.slot_time!).getTime());
  };

  const selectedBookings = getDayBookings(selectedDay);
  const stats = {
    today: getDayBookings(new Date()).length,
    total: filteredBookings.length,
    completed: bookings.filter((b) => b.status === "completed").length,
    week: filteredBookings.filter((b) => { if (!b.slot_time) return false; const d = parseISO(b.slot_time); return d >= new Date() && d <= addDays(new Date(), 7); }).length,
  };

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div><h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Календарь записей</h1><p className="text-sm text-[#6B7280] mt-1">Управление клиентскими записями</p></div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-[280px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск клиента..." className="w-full h-11 rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" /></div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-1">
                <button onClick={() => setSelectedType("all")} className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${selectedType === "all" ? "bg-[#111827] text-white" : "text-[#6B7280]"}`}>Все</button>
                {SERVICE_TYPES.map((s) => (<button key={s.value} onClick={() => setSelectedType(s.value)} className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${selectedType === s.value ? "bg-[#111827] text-white" : "text-[#6B7280]"}`}>{s.label}</button>))}
              </div>
              <button onClick={fetchBookings} className="h-11 px-4 rounded-2xl border border-gray-200 bg-white flex items-center gap-2 text-sm font-medium hover:bg-gray-50 transition-all"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />Обновить</button>
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
            <StatCard title="Сегодня" value={stats.today} /><StatCard title="На неделе" value={stats.week} /><StatCard title="Всего записей" value={stats.total} /><StatCard title="Завершено" value={stats.completed} />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_420px] gap-6 items-start">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="w-11 h-11 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronLeft className="w-5 h-5 text-[#6B7280]" /></button>
                <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="w-11 h-11 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all"><ChevronRight className="w-5 h-5 text-[#6B7280]" /></button>
              </div>
              <div className="text-center"><h2 className="text-xl font-semibold text-[#111827] capitalize">{format(currentMonth, "LLLL yyyy", { locale: ru })}</h2><p className="text-sm text-[#6B7280] mt-1">{filteredBookings.length} записей</p></div>
              <button onClick={() => setCurrentMonth(new Date())} className="h-11 px-4 rounded-2xl bg-[#111827] text-white text-sm font-medium hover:opacity-90 transition-all">Сегодня</button>
            </div>
            <div className="grid grid-cols-7 px-4 pt-4">{weekDays.map((d) => (<div key={d} className="h-12 flex items-center justify-center text-sm font-medium text-[#6B7280]">{d}</div>))}</div>
            <div className="grid grid-cols-7 gap-2 p-4">
              {days.map((d) => {
                const dayBookings = getDayBookings(d);
                const isCurrent = isSameMonth(d, currentMonth);
                const isSelected = isSameDay(d, selectedDay);
                const isToday = isSameDay(d, new Date());
                const density = dayBookings.length >= 6 ? "bg-teal-100" : dayBookings.length >= 4 ? "bg-teal-50" : "";
                return (
                  <button key={d.toISOString()} onClick={() => setSelectedDay(d)}
                    className={`relative min-h-[120px] rounded-3xl border p-3 text-left transition-all overflow-hidden ${!isCurrent ? "opacity-30" : "hover:shadow-lg hover:-translate-y-0.5"} ${isSelected ? "border-teal-300 bg-teal-50 ring-2 ring-teal-500/20 shadow-lg" : "border-gray-100 bg-white"} ${density}`}>
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
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedDay(d); setShowAddModal(true); }} className="absolute bottom-3 right-3 w-7 h-7 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-50 transition-all"><Plus className="w-3.5 h-3.5" /></button>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sticky top-28">
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold text-[#111827]">{format(selectedDay, "d MMMM, EEEE", { locale: ru })}</h3><p className="text-sm text-[#6B7280] mt-1">{selectedBookings.length} записей</p></div>
                  <button onClick={() => setShowAddModal(true)} className="h-11 px-4 rounded-2xl bg-[#111827] text-white flex items-center gap-2 text-sm font-medium hover:opacity-90 transition-all"><Plus className="w-4 h-4" />Добавить</button>
                </div>
              </div>
              <div className="max-h-[760px] overflow-y-auto p-6">
                {loading ? (
                  <div className="space-y-3">{[...Array(6)].map((_, i) => (<div key={i} className="h-28 rounded-3xl bg-gray-100 animate-pulse" />))}</div>
                ) : selectedBookings.length === 0 ? (
                  <div className="text-center py-20"><div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><CalendarDays className="w-6 h-6 text-[#9CA3AF]" /></div><h4 className="font-semibold text-[#111827]">Нет записей</h4><p className="text-sm text-[#6B7280] mt-1">Добавьте новую запись</p></div>
                ) : (
                  <div className="space-y-4">
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
                                <div className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-medium border border-green-200">Подтв.</div>
                              </div>
                              <div className="flex items-center gap-2 mt-5">
                                <button disabled={updatingId === booking.id} onClick={() => handleStatusChange(booking.id, "completed")} className="h-10 px-4 rounded-2xl bg-[#111827] text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"><Check className="w-4 h-4" />Завершить</button>
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
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[32px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div><h3 className="text-lg font-semibold text-[#111827]">Новая запись</h3><p className="text-sm text-[#6B7280] mt-1">{format(selectedDay, "d MMMM yyyy", { locale: ru })}</p></div>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-2xl hover:bg-gray-100 flex items-center justify-center transition-all"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <form onSubmit={handleAddBooking} className="p-6 space-y-4">
              <input required placeholder="Имя клиента" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              <input required placeholder="Телефон" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newService} onChange={(e) => setNewService(e.target.value as ServiceType)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all bg-white">{SERVICE_TYPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}</select>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" />
              </div>
              <button type="submit" disabled={adding} className="w-full h-12 rounded-2xl bg-[#111827] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">{adding ? "Добавление..." : "Добавить запись"}</button>
            </form>
          </div>
        </div>
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
