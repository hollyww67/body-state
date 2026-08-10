"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Check, X, RefreshCw, Video, Search, Phone, CalendarDays, Clock3,
  CheckCircle2, AlertCircle, XCircle, Loader2, Plus, Users, UserCheck, Calendar, Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Booking, BookingStatus, ServiceType } from "@/lib/api/bookings";
import { getBookings, patchBooking, TYPE_LABELS } from "@/lib/api/bookings";

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: any }> = {
  pending: { label: "Новая", className: "bg-amber-50 text-amber-700 border border-amber-200", icon: AlertCircle },
  confirmed: { label: "Подтверждена", className: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Отменена", className: "bg-rose-50 text-rose-700 border border-rose-200", icon: XCircle },
  completed: { label: "Завершена", className: "bg-slate-100 text-slate-600 border border-slate-200", icon: Check },
};

const SERVICE_TYPES: { value: ServiceType; label: string; color: string }[] = [
  { value: "bfm", label: "БФМ", color: "bg-amber-500" },
  { value: "brt", label: "БРТ", color: "bg-emerald-500" },
  { value: "psychology", label: "Психология", color: "bg-sky-500" },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newDate, setNewDate] = useState(""); const [newTime, setNewTime] = useState("10:00");
  const [adding, setAdding] = useState(false); const [addError, setAddError] = useState("");

  const fetchBookings = useCallback(async () => {
    try { setLoading(true); const data = await getBookings();
      // Сортировка: pending first, затем по времени слота (ближайшие сверху)
      data.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        const tA = a.slot_time ? new Date(a.slot_time).getTime() : Infinity;
        const tB = b.slot_time ? new Date(b.slot_time).getTime() : Infinity;
        return tA - tB;
      });
      setBookings(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); const i = setInterval(fetchBookings, 30000); return () => clearInterval(i); }, [fetchBookings]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    setUpdatingId(id); const prev = bookings;
    setBookings((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    try { await patchBooking(id, status); } catch { setBookings(prev); } finally { setUpdatingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const prev = bookings;
    setBookings((p) => p.filter((b) => b.id !== deleteTarget.id));
    try {
      const res = await fetch("/api/admin/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const data = await res.json(); toast.error(data.error || "Ошибка"); setBookings(prev); }
      else toast.success("Заявка удалена");
    } catch { setBookings(prev); toast.error("Ошибка"); }
    finally { setDeleteTarget(null); setDeleting(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddError("");
    if (!newName.trim() || !newPhone.trim() || !newDate) return;
    setAdding(true);
    const slotTime = new Date(`${newDate}T${newTime}:00`).toISOString();
    const slotRes = await fetch("/api/admin/slots/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: [{ service_type: newService, slot_time: slotTime }] }) });
    if (!slotRes.ok) { setAddError("Ошибка слота"); setAdding(false); return; }
    await new Promise((r) => setTimeout(r, 500));
    const listRes = await fetch("/api/admin/slots/list"); const listData = await listRes.json();
    const allSlots = listData.slots || [];
    const createdSlot = allSlots.find((s: any) => {
      if (s.service_type !== newService || s.is_booked) return false;
      const sd = new Date(s.slot_time); const td = new Date(slotTime);
      return sd.getFullYear() === td.getFullYear() && sd.getMonth() === td.getMonth() && sd.getDate() === td.getDate() && sd.getHours() === td.getHours() && sd.getMinutes() === td.getMinutes();
    }) || allSlots.filter((s: any) => s.service_type === newService && !s.is_booked).sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    if (!createdSlot) { setAddError("Слот не найден"); setAdding(false); return; }
    const bookingRes = await fetch(`/api/book/${newService}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_id: createdSlot.id, client_name: newName, client_phone: newPhone }) });
    const bookingData = await bookingRes.json();
    if (!bookingRes.ok) { setAddError(bookingData.error || "Ошибка"); setAdding(false); return; }
    if (bookingData.booking?.id) await patchBooking(bookingData.booking.id, "confirmed");
    setShowAddForm(false); setNewName(""); setNewPhone(""); setNewDate(""); setNewTime("10:00"); setAdding(false); fetchBookings();
    toast.success("Запись создана");
  };

  const filtered = useMemo(() => {
    let result = bookings;
    if (filter !== "all") result = result.filter((b) => b.status === filter);
    if (search.trim()) { const s = search.toLowerCase(); result = result.filter((b) => b.client_name.toLowerCase().includes(s) || b.client_phone.includes(s)); }
    return result;
  }, [bookings, filter, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    filtered.forEach((b) => {
      if (!b.slot_time) return;
      const d = new Date(b.slot_time); let key = format(d, "d MMMM", { locale: ru });
      if (isToday(d)) key = "Сегодня"; if (isTomorrow(d)) key = "Завтра";
      if (!groups[key]) groups[key] = []; groups[key].push(b);
    });
    return groups;
  }, [filtered]);

  const now = new Date();
  const stats = {
    pending: bookings.filter((b) => b.status === "pending").length,
    today: bookings.filter((b) => b.slot_time && isToday(new Date(b.slot_time))).length,
    week: bookings.filter((b) => b.slot_time && isThisWeek(new Date(b.slot_time))).length,
    online: bookings.filter((b) => b.booking_type === "online" && b.status === "confirmed").length,
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/90 backdrop-blur-xl pb-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
            <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Заявки</h1><p className="text-sm text-slate-500 mt-1">Управление клиентскими бронированиями</p></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddForm(true)} className="h-11 px-4 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/10 flex items-center gap-2 text-sm font-medium hover:bg-black transition-all"><Plus className="w-4 h-4" /> Новая запись</button>
              <button onClick={fetchBookings} className="h-11 px-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm flex items-center gap-2 text-sm font-medium text-slate-700 transition-all"><RefreshCw className="w-4 h-4" /> Обновить</button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Новых", value: stats.pending, icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
              { label: "Сегодня", value: stats.today, icon: Calendar, color: "text-blue-600 bg-blue-50" },
              { label: "На неделе", value: stats.week, icon: Clock, color: "text-purple-600 bg-purple-50" },
              { label: "Онлайн", value: stats.online, icon: Video, color: "text-teal-600 bg-teal-50" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-xs text-slate-500">{s.label}</p><p className="text-xl font-bold text-slate-900">{s.value}</p></div>
              </div>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="Поиск по имени или телефону..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" /></div>
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1">
              {[{ key: "all", label: "Все" }, { key: "pending", label: "Новые" }, { key: "confirmed", label: "Подтв." }, { key: "cancelled", label: "Отмен." }, { key: "completed", label: "Заверш." }].map((item) => (
                <button key={item.key} onClick={() => setFilter(item.key as any)}
                  className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${filter === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Add modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div><h3 className="text-lg font-semibold text-slate-900">Новая запись</h3><p className="text-sm text-slate-500 mt-1">Заполните данные клиента</p></div>
                <button onClick={() => setShowAddForm(false)} className="w-10 h-10 rounded-2xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Имя клиента</label><input required placeholder="Анна Петрова" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Телефон</label><input required type="tel" placeholder="+7 999 123-45-67" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Услуга</label><select value={newService} onChange={(e) => setNewService(e.target.value as ServiceType)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm">{SERVICE_TYPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}</select></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Дата</label><input required type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm" /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Время</label><input required type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm" /></div>
                  </div>
                </div>
                {addError && <p className="text-red-500 text-sm">{addError}</p>}
                <button type="submit" disabled={adding} className="w-full h-12 rounded-2xl bg-slate-900 text-white text-sm font-medium hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Создать запись</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4"><XCircle className="w-7 h-7 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Удалить заявку?</h3>
              <p className="text-sm text-slate-500 mb-2">{deleteTarget.client_name} • {deleteTarget.slot_time ? format(new Date(deleteTarget.slot_time), "d MMM, HH:mm", { locale: ru }) : ""}</p>
              <p className="text-xs text-slate-400 mb-6">Это действие необратимо</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-2xl border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-all">Отмена</button>
                <button onClick={confirmDelete} disabled={deleting} className="flex-1 h-11 rounded-2xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50">{deleting ? "Удаление..." : "Удалить"}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4 mt-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-32 bg-slate-100 rounded" /><div className="h-3 w-24 bg-slate-100 rounded" /></div>
                  <div className="flex gap-2"><div className="h-10 w-24 bg-slate-100 rounded-2xl" /><div className="h-10 w-24 bg-slate-100 rounded-2xl" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 mt-4 bg-white rounded-3xl border border-slate-100">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-5"><CalendarDays className="w-10 h-10 text-slate-300" /></div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{bookings.length === 0 ? "Пока нет заявок" : "Ничего не найдено"}</h3>
            <p className="text-sm text-slate-500">{bookings.length === 0 ? "Создайте первую запись" : "Попробуйте изменить фильтры"}</p>
            {bookings.length === 0 && <button onClick={() => setShowAddForm(true)} className="mt-4 h-11 px-5 rounded-2xl bg-slate-900 text-white text-sm font-medium hover:bg-black transition-all inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Создать запись</button>}
          </div>
        ) : (
          <div className="space-y-8 mt-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="flex items-center gap-3 mb-4"><h2 className="text-lg font-semibold text-slate-900">{group}</h2><div className="h-px flex-1 bg-slate-200" /></div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {items.map((b) => {
                      const status = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                      const Icon = status.icon;
                      const canDelete = b.status === "completed" || b.status === "cancelled";
                      const service = SERVICE_TYPES.find((s) => s.value === b.service_type);
                      const initials = getInitials(b.client_name);
                      return (
                        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} key={b.id}
                          className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-300">
                          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              {/* Avatar */}
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${b.status === "pending" ? "bg-amber-100 text-amber-700" : b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : b.status === "cancelled" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-slate-900">{b.client_name}</h3>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${status.className}`}><Icon className="w-3 h-3" />{status.label}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium">{TYPE_LABELS[b.service_type] || b.service_type}</span>
                                  {b.booking_type === "online" && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">Онлайн</span>}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                  <a href={`tel:${b.client_phone}`} className="flex items-center gap-1 hover:text-teal-600 transition-colors"><Phone className="w-3.5 h-3.5" />{b.client_phone}</a>
                                  {b.slot_time && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{format(new Date(b.slot_time), "HH:mm", { locale: ru })}</span>}
                                </div>
                                {b.room_id && <p className="mt-1 text-xs text-slate-400 font-mono cursor-pointer hover:text-teal-600" onClick={() => { navigator.clipboard.writeText(b.room_id!); toast.success("ID комнаты скопирован"); }}>Комната: {b.room_id}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {b.status === "confirmed" && b.booking_type === "online" && b.room_id && (
                                <button onClick={() => router.push(`/psychology/room?id=${b.room_id}&role=doctor`)} className="h-10 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"><Video className="w-4 h-4" />Войти</button>
                              )}
                              {b.status === "pending" && (<>
                                <button onClick={() => updateStatus(b.id, "confirmed")} disabled={updatingId === b.id} className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-all flex items-center gap-2">{updatingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Подтвердить</button>
                                <button onClick={() => updateStatus(b.id, "cancelled")} disabled={updatingId === b.id} className="h-10 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-medium transition-all border border-rose-200 flex items-center gap-2"><X className="w-4 h-4" />Отменить</button>
                              </>)}
                              {b.status === "confirmed" && (
                                <button onClick={() => updateStatus(b.id, "completed")} className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white text-sm font-medium transition-all">Завершить</button>
                              )}
                              {canDelete && (
                                <button onClick={() => setDeleteTarget(b)} className="h-10 w-10 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-all flex items-center justify-center" title="Удалить"><X className="w-4 h-4" /></button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
