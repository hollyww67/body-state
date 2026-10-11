"use client";

import { useEffect, useMemo, useState, useCallback,useRef } from "react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Check, X, RefreshCw, Video, Search, Phone, CalendarDays, Clock3,
  CheckCircle2, AlertCircle, XCircle, Loader2, Plus, Calendar, Clock, Mail, MessageSquareText, UserRound, Copy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Booking, BookingStatus, ServiceType } from "@/lib/api/bookings";
import { getBookings, patchBooking, TYPE_LABELS } from "@/lib/api/bookings";
import { formatRussianPhoneInput } from "@/lib/phone";
import AdminConfirmDialog, { AdminModal } from "@/components/admin/AdminConfirmDialog";

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: any }> = {
  pending: { label: "Ожидает оплаты", className: "bg-amber-50 text-amber-700 border border-amber-200", icon: AlertCircle },
  confirmed: { label: "Подтверждена", className: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Отменена", className: "bg-rose-50 text-rose-700 border border-rose-200", icon: XCircle },
  completed: { label: "Завершена", className: "bg-slate-100 text-slate-600 border border-slate-200", icon: Check },
};

const SERVICE_TYPES: { value: ServiceType; label: string; color: string }[] = [
  { value: "bfm", label: "Физическая реабилитация", color: "bg-amber-500" },
  { value: "brt", label: "БРТ", color: "bg-emerald-500" },
  { value: "psychology", label: "Психологическая реабилитация", color: "bg-sky-500" },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const router = useRouter();
  const openedLink=useRef(false);
  useEffect(()=>{if(openedLink.current||!bookings.length)return;const id=new URLSearchParams(window.location.search).get('booking');const b=bookings.find(b=>b.id===id);if(b){setSelectedBooking(b);openedLink.current=true;}},[bookings]);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("create") === "1") setShowAddForm(true); }, []);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newDate, setNewDate] = useState(""); const [newTime, setNewTime] = useState("10:00");
  const [adding, setAdding] = useState(false); const [addError, setAddError] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ id: string; slot_time: string }>>([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkReason, setLinkReason] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  useEffect(() => { setLinkEmail(""); setLinkReason(""); setIdentityConfirmed(false); }, [selectedBooking?.id]);

  const fetchBookings = useCallback(async () => {
    try { setLoading(true); setLoadError(false); const data = await getBookings();
      // Сортировка: ожидающие оплаты сначала, затем по времени слота.
      data.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        const tA = a.slot_time ? new Date(a.slot_time).getTime() : Infinity;
        const tB = b.slot_time ? new Date(b.slot_time).getTime() : Infinity;
        return tA - tB;
      });
      setBookings(data);
    } catch { setLoadError(true); toast.error("Не удалось загрузить записи"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); const i = setInterval(fetchBookings, 30000); return () => clearInterval(i); }, [fetchBookings]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    setUpdatingId(id); const prev = bookings;
    setBookings((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    try {
      await patchBooking(id, status);
      setSelectedBooking(p => p?.id === id ? { ...p, status } : p);
      toast.success(status === "completed" ? "Посещение засчитано" : "Статус обновлён");
    } catch (error) { setBookings(prev); toast.error(error instanceof Error ? error.message : "Не удалось обновить запись"); }
    finally { setUpdatingId(null); }
  };

  const bookingAction = async (action: "link_account" | "no_show") => {
    if (!selectedBooking || updatingId) return;
    setUpdatingId(selectedBooking.id);
    try {
      const response = await fetch('/api/admin/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedBooking.id, action, account_email: linkEmail, link_reason: linkReason, identity_confirmed: identityConfirmed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить');
      setSelectedBooking(p => p ? { ...p, account_user_id: result.booking.account_user_id, status: result.booking.status, attendance: result.booking.attendance } : p);
      await fetchBookings();
      toast.success(action === 'link_account' ? 'Запись привязана к личному кабинету' : 'Неявка отмечена. Бонусы не начислены.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка сохранения'); }
    finally { setUpdatingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch("/api/admin/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Не удалось удалить запись. Попробуйте ещё раз."); }
    setBookings(p => p.filter(b => b.id !== deleteTarget.id));
    toast.success("Заявка удалена");
    void fetchBookings();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddError("");
    if (!newName.trim() || !newPhone.trim() || !newDate || !consentConfirmed) return;
    setAdding(true);
    try {
    const slotTime = new Date(`${newDate}T${newTime}:00+03:00`).toISOString();
    const bookingRes = await fetch("/api/admin/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_type: newService, slot_time: slotTime, client_name: newName, client_phone: newPhone, consent_confirmed: consentConfirmed }) });
    const bookingData = await bookingRes.json();
    if (!bookingRes.ok) { setAddError(bookingData.error || "Ошибка"); setAdding(false); return; }
    setShowAddForm(false); setNewName(""); setNewPhone(""); setNewDate(""); setNewTime("10:00"); setConsentConfirmed(false); setAdding(false); fetchBookings();
    toast.success("Запись создана");
    } catch { setAddError("Не удалось создать запись. Проверьте соединение."); }
    finally { setAdding(false); }
  };

  const openReschedule = async () => {
    if (!selectedBooking || !["bfm", "brt", "psychology"].includes(selectedBooking.service_type)) return;
    setRescheduling(true); setRescheduleSlotId("");
    try {
      const response = await fetch(`/api/slots?service_type=${selectedBooking.service_type}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить время");
      setRescheduleSlots(result.slots || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка расписания"); setRescheduling(false); }
  };

  const submitReschedule = async () => {
    if (!selectedBooking || !rescheduleSlotId) return;
    setUpdatingId(selectedBooking.id);
    try {
      const response = await fetch("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedBooking.id, service_type: selectedBooking.service_type, slot_id: rescheduleSlotId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось перенести запись");
      toast.success("Запись перенесена"); setRescheduling(false); setSelectedBooking(null); await fetchBookings();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось перенести запись"); }
    finally { setUpdatingId(null); }
  };

  const filtered = useMemo(() => {
    let result = bookings;
    if (filter !== "all") result = result.filter((b) => b.status === filter);
    if (search.trim()) { const s = search.trim().toLowerCase(); const digits = s.replace(/\D/g, ""); result = result.filter((b) => b.client_name?.toLowerCase().includes(s) || (digits.length > 0 && b.client_phone?.replace(/\D/g, "").includes(digits.replace(/^8(?=\d{10}$)/, "7"))) || b.client_email?.toLowerCase().includes(s)); }
    return result;
  }, [bookings, filter, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    filtered.forEach((b) => {
      let key = "Обращения без выбранного времени";
      if (b.slot_time) {
        const d = new Date(b.slot_time); key = format(d, "d MMMM yyyy", { locale: ru });
        if (isToday(d)) key = "Сегодня"; if (isTomorrow(d)) key = "Завтра";
      }
      if (!groups[key]) groups[key] = []; groups[key].push(b);
    });
    return groups;
  }, [filtered]);

  const stats = {
    pending: bookings.filter((b) => b.status === "pending").length,
    today: bookings.filter((b) => b.slot_time && isToday(new Date(b.slot_time))).length,
    week: bookings.filter((b) => b.slot_time && isThisWeek(new Date(b.slot_time))).length,
    online: bookings.filter((b) => b.booking_type === "online" && b.status === "confirmed").length,
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="admin-bookings-page min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-8 py-3 sm:py-6">
        {/* Sticky header */}
        <div className="admin-bookings-toolbar sticky top-0 z-30 bg-[#F8FAFC]/90 backdrop-blur-xl pb-4 sm:pb-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
            <div><h2 className="text-xl font-semibold tracking-tight text-slate-900">Найти запись</h2><p className="text-sm text-slate-500 mt-1">Откройте карточку клиента для переноса, отмены и отметки посещения</p></div>
            <div className="grid grid-cols-2 items-center gap-2 sm:flex">
              <button onClick={() => setShowAddForm(true)} className="h-11 px-4 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/10 flex items-center gap-2 text-sm font-medium hover:bg-black transition-all"><Plus className="w-4 h-4" /> Новая запись</button>
              <button onClick={fetchBookings} className="h-11 px-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm flex items-center gap-2 text-sm font-medium text-slate-700 transition-all"><RefreshCw className="w-4 h-4" /> Обновить</button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Ждут оплату", value: stats.pending, icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
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
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="search" aria-label="Поиск клиента по имени, телефону или email" placeholder="Имя, телефон или email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" /></div>
            <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-2xl p-1">
              {[{ key: "all", label: "Все" }, { key: "pending", label: "Ждут оплату" }, { key: "confirmed", label: "Подтверждены" }, { key: "cancelled", label: "Отменены" }, { key: "completed", label: "Завершены" }].map((item) => (
                <button key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key as any)}
                  className={`px-3 h-9 rounded-xl text-sm font-medium transition-all ${filter === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item.label}</button>
              ))}
            </div>
          </div>
        </div>

        {loadError && <div role="alert" className="admin-dashboard-error mb-4">Не удалось обновить записи. <button type="button" onClick={fetchBookings}>Повторить загрузку</button></div>}
        {(search || filter !== "all") && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><span>{loading ? "Поиск…" : `Найдено записей: ${filtered.length}`}</span><button type="button" className="admin-secondary-action" onClick={() => { setSearch(""); setFilter("all"); }}>Сбросить фильтры</button></div>}
        {/* Add modal */}
        {showAddForm && (
          <AdminModal title="Новая запись" onCancel={() => setShowAddForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div><h3 className="text-lg font-semibold text-slate-900">Новая запись</h3><p className="text-sm text-slate-500 mt-1">Заполните данные клиента</p></div>
                <button type="button" aria-label="Закрыть форму новой записи" onClick={() => setShowAddForm(false)} className="w-10 h-10 rounded-2xl hover:bg-slate-100 flex items-center justify-center"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Имя клиента</label><input required placeholder="Анна Петрова" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Телефон</label><input required type="tel" placeholder="+7 (999) 123-45-67" value={newPhone} onChange={(e) => setNewPhone(formatRussianPhoneInput(e.target.value))} className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-sm focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Услуга</label><select value={newService} onChange={(e) => setNewService(e.target.value as ServiceType)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm">{SERVICE_TYPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}</select></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Дата</label><input required type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm" /></div>
                    <div><label className="block text-xs font-medium text-slate-500 mb-1">Время</label><input required type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-sm" /></div>
                  </div>
                  <label className="flex items-start gap-3 text-xs text-slate-600"><input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} className="mt-0.5" /><span>Клиент дал согласие на обработку персональных данных и запись на услугу.</span></label>
                </div>
                {addError && <p className="text-red-500 text-sm">{addError}</p>}
                <button type="submit" disabled={adding} className="w-full h-12 rounded-2xl bg-slate-900 text-white text-sm font-medium hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Создать запись</button>
              </form>
            </motion.div>
          </AdminModal>
        )}

        {/* Client details modal */}
        {selectedBooking && (
          <AdminModal title="Карточка клиента" onCancel={() => setSelectedBooking(null)}>
            <motion.section aria-labelledby="booking-detail-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="admin-booking-modal max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-[32px]">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur-xl sm:p-6">
                <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-teal-700">Карточка клиента</p><h2 id="booking-detail-title" className="text-xl font-bold text-slate-900 sm:text-2xl">{selectedBooking.client_name}</h2><p className="mt-1 text-xs text-slate-500">Заявка {selectedBooking.id.slice(0, 8)} · {new Date(selectedBooking.created_at).toLocaleString("ru-RU")}</p></div>
                <button type="button" onClick={() => setSelectedBooking(null)} className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Закрыть карточку"><X className="h-5 w-5" /></button>
              </header>
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Контакты</p><div className="space-y-3 text-sm"><a href={`tel:${selectedBooking.client_phone}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-teal-700"><Phone className="h-4 w-4" />{selectedBooking.client_phone}</a>{selectedBooking.client_email && <a href={`mailto:${selectedBooking.client_email}`} className="flex items-center gap-2 break-all text-slate-700 hover:text-teal-700"><Mail className="h-4 w-4 flex-none" />{selectedBooking.client_email}</a>}{selectedBooking.client_tg && <p className="flex items-center gap-2 text-slate-700"><MessageSquareText className="h-4 w-4" />{selectedBooking.client_tg}</p>}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Услуга и статус</p><div className="space-y-2 text-sm"><p className="font-semibold text-slate-900">{TYPE_LABELS[selectedBooking.service_type] || selectedBooking.service_type}</p><p className="text-slate-600">{STATUS_CONFIG[selectedBooking.status]?.label || selectedBooking.status}</p><p className="text-slate-600">{selectedBooking.slot_time ? new Date(selectedBooking.slot_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "Время ещё не выбрано"}</p>{selectedBooking.booking_type && <p className="text-slate-600">Формат: {selectedBooking.booking_type === "online" ? "онлайн" : "очно"}</p>}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Запрос клиента</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedBooking.notes || "Комментарий не оставлен."}</p></div>
                <div className="rounded-2xl border border-slate-200 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><UserRound className="h-4 w-4" />Личный кабинет</p><p className="text-xs leading-5 text-slate-500">{selectedBooking.account_user_id ? "Заявка связана с аккаунтом клиента" : "Заявка отправлена без авторизации"}</p>
                  {!selectedBooking.account_user_id && <div className="mt-3 space-y-3">
                    <label className="block text-xs text-slate-700">Email аккаунта<input type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>
                    <label className="block text-xs text-slate-700">Основание проверки личности<input value={linkReason} onChange={e => setLinkReason(e.target.value)} placeholder="Например, подтверждено клиентом на приёме" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>
                    <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={identityConfirmed} onChange={e => setIdentityConfirmed(e.target.checked)} />Личность проверена, клиент подтвердил принадлежность аккаунта</label>
                    <button type="button" disabled={!identityConfirmed || !linkEmail || linkReason.trim().length < 5 || !!updatingId} onClick={() => bookingAction('link_account')} className="min-h-11 w-full rounded-xl bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Привязать запись</button>
                  </div>}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4"><p className="mb-2 text-sm font-semibold text-slate-800">Согласие на обработку</p><p className="text-xs leading-5 text-slate-500">{selectedBooking.consent_at ? `Зафиксировано ${new Date(selectedBooking.consent_at).toLocaleString("ru-RU")}${selectedBooking.consent_version ? ` · ${selectedBooking.consent_version}` : ""}` : "Сведения о согласии отсутствуют"}</p></div>
                {selectedBooking.room_id && <button type="button" onClick={() => { navigator.clipboard.writeText(selectedBooking.room_id!); toast.success("ID комнаты скопирован"); }} className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 sm:col-span-2"><Copy className="h-4 w-4" />Скопировать ID комнаты</button>}
                {["bfm", "brt", "psychology"].includes(selectedBooking.service_type) && !["cancelled", "completed"].includes(selectedBooking.status) && (
                  <div className="rounded-2xl border border-slate-200 p-4 sm:col-span-2">
                    {!rescheduling ? <button type="button" onClick={openReschedule} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700"><Calendar className="h-4 w-4" />Перенести запись</button> : <div className="space-y-3"><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Новое свободное время</label><select value={rescheduleSlotId} onChange={(event) => setRescheduleSlotId(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"><option value="">Выберите дату и время</option>{rescheduleSlots.map((slot) => <option key={slot.id} value={slot.id}>{new Date(slot.slot_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</option>)}</select><div className="flex gap-2"><button type="button" onClick={() => setRescheduling(false)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm">Назад</button><button type="button" disabled={!rescheduleSlotId || updatingId === selectedBooking.id} onClick={submitReschedule} className="flex-1 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Сохранить</button></div></div>}
                  </div>
                )}
              </div>
              <footer className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-100 bg-white/95 p-5 backdrop-blur-xl sm:p-6">
                {selectedBooking.attendance === 'absent' && <p className="text-sm text-rose-700">Клиент не пришёл — посещение не засчитано.</p>}
                {!['cancelled','completed'].includes(selectedBooking.status) && <button type="button" disabled={!!updatingId} onClick={() => updateStatus(selectedBooking.id, 'cancelled')} className="w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50">Отменить запись</button>}
                {selectedBooking.status === 'confirmed' && <>
                  <button type="button" disabled={!!updatingId} onClick={() => updateStatus(selectedBooking.id, 'completed')} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Приём состоялся — засчитать посещение</button>
                  <button type="button" disabled={!!updatingId} onClick={() => bookingAction('no_show')} className="w-full rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50">Клиент не пришёл</button>
                </>}
              </footer>
            </motion.section>
          </AdminModal>
        )}

        {/* Delete modal */}
        {deleteTarget && (
          <AdminConfirmDialog title="Удалить запись?" onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
            <p>{deleteTarget.client_name} • {deleteTarget.slot_time ? format(new Date(deleteTarget.slot_time), "d MMM, HH:mm", { locale: ru }) : ""}</p>
            <p>Вы действительно хотите удалить эту запись? Это действие может быть необратимым.</p>
          </AdminConfirmDialog>
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
        ) : loadError && bookings.length === 0 ? (
          <p className="py-10 text-center text-sm">Список записей недоступен. Повторите загрузку выше.</p>
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
                      const initials = getInitials(b.client_name);
                      return (
                        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} key={b.id}
                          role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) setSelectedBooking(b); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedBooking(b); } }}
                          className="group cursor-pointer bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-teal-500/10">
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
                                  {b.payment_status === "due" && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-medium">Оплата на приёме</span>}
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
                                <button onClick={(event) => { event.stopPropagation(); router.push(`/psychology/room?id=${b.room_id}&role=doctor`); }} className="h-10 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all flex items-center gap-2"><Video className="w-4 h-4" />Войти</button>
                              )}
                              {b.status === "pending" && <button onClick={(event) => { event.stopPropagation(); updateStatus(b.id, "cancelled"); }} disabled={updatingId === b.id} className="h-10 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-medium transition-all border border-rose-200 flex items-center gap-2"><X className="w-4 h-4" />Отменить</button>}
                              {b.status === "confirmed" && (
                                <button disabled={!!updatingId} onClick={(event) => { event.stopPropagation(); updateStatus(b.id, "completed"); }} className="min-h-11 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white text-sm font-medium transition-all disabled:opacity-50">Приём состоялся</button>
                              )}
                              {canDelete && (
                                <button onClick={(event) => { event.stopPropagation(); setDeleteTarget(b); }} className="h-10 w-10 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-all flex items-center justify-center" title="Удалить"><X className="w-4 h-4" /></button>
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
