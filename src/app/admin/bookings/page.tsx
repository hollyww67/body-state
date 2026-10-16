"use client";
import { AdminButton, AdminInput, AdminCheckbox, AdminSelect, AdminCard, AdminBadge, AdminField, AdminFeedback } from '@/components/admin/ui';

import { useEffect, useMemo, useState, useCallback,useRef } from "react";
import { formatMoscow as format, isMoscowToday as isToday, isMoscowTomorrow as isTomorrow, moscowInputToISO } from "@/lib/moscow-time";
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
import BookingHistory from '@/components/admin/BookingHistory';
import SchedulingClientPicker from '@/components/admin/SchedulingClientPicker';

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string; icon: any }> = {
  new: {label:'Новая заявка',className:'bg-[var(--bs-surface-muted)] text-[var(--bs-foreground)] border border-[var(--bs-border)]',icon:AlertCircle},
  pending: { label: "Ожидает оплаты", className: "bg-[var(--bs-warning-bg)] text-[var(--bs-warning)] border border-[var(--bs-border)]", icon: AlertCircle },
  confirmed: { label: "Подтверждена", className: "bg-[var(--bs-success-bg)] text-[var(--bs-success)] border border-[var(--bs-border)]", icon: CheckCircle2 },
  cancelled: { label: "Отменена", className: "bg-[var(--bs-destructive-bg)] text-[var(--bs-destructive)] border border-[var(--bs-border)]", icon: XCircle },
  completed: { label: "Завершена", className: "bg-[var(--bs-surface-muted)] text-[var(--bs-muted)] border border-[var(--bs-border)]", icon: Check },
};

const SERVICE_TYPES: { value: ServiceType; label: string; color: string }[] = [
  { value: "bfm", label: "Физическая реабилитация", color: "bg-[var(--bs-warning-bg)]" },
  { value: "brt", label: "БРТ", color: "bg-[var(--bs-success-bg)]" },
  { value: "psychology", label: "Психологическая реабилитация", color: "bg-[var(--bs-info-bg)]" },
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
  const loadedOnce=useRef(false),loadSequence=useRef(0),loadAbort=useRef<AbortController|null>(null);
  const [historyRevision,setHistoryRevision]=useState(0);
  const [includeArchived,setIncludeArchived]=useState(false),[pageOffset,setPageOffset]=useState(0),[nextOffset,setNextOffset]=useState<number|null>(null);
  const [counts,setCounts]=useState({total:0,pending:0,today:0,week:0,online:0});
  const [serverSearch,setServerSearch]=useState('');
  const activeCard=useRef<Booking|null>(null);
  useEffect(()=>{activeCard.current=selectedBooking;},[selectedBooking]);
  useEffect(()=>{const timer=setTimeout(()=>{setServerSearch(search.trim());setPageOffset(0);},250);return()=>clearTimeout(timer);},[search]);
  const [actionConfirm,setActionConfirm]=useState<{id:string;status:BookingStatus|'no_show';name:string}|null>(null);
  useEffect(()=>{if(openedLink.current||loading||loadError)return;const id=new URLSearchParams(window.location.search).get('booking');if(!id)return;const b=bookings.find(b=>b.id===id);if(b){setSelectedBooking(b);openedLink.current=true;return;}const abort=new AbortController();getBookings(abort.signal,`id=${encodeURIComponent(id)}&archived=true`).then(data=>{if(!abort.signal.aborted){openedLink.current=true;if(data[0])setSelectedBooking(data[0]);else toast.error('Запись не найдена');}}).catch(()=>{if(!abort.signal.aborted)toast.error('Не удалось открыть запись');});return()=>abort.abort();},[bookings,loading,loadError]);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("create") === "1") setShowAddForm(true); }, []);
  const [newName, setNewName] = useState(""); const [newPhone, setNewPhone] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [newAccountId,setNewAccountId]=useState<string|null>(null),[newIdentity,setNewIdentity]=useState(false);
  const [newService, setNewService] = useState<ServiceType>("bfm");
  const [newDate, setNewDate] = useState(""); const [newTime, setNewTime] = useState("10:00");
  const [adding, setAdding] = useState(false); const [addError, setAddError] = useState("");
  const createRequest=useRef({signature:'',key:''});
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ id: string; slot_time: string }>>([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState("");
  const [rescheduleReason,setRescheduleReason]=useState('');
  const [linkEmail, setLinkEmail] = useState("");
  const [linkReason, setLinkReason] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  useEffect(() => { setLinkEmail(""); setLinkReason(""); setIdentityConfirmed(false);setRescheduling(false);setRescheduleSlots([]);setRescheduleSlotId(''); }, [selectedBooking?.id]);

  const fetchBookings = useCallback(async () => {
    const seq=++loadSequence.current;loadAbort.current?.abort();const abort=new AbortController();loadAbort.current=abort;
    try {if(!loadedOnce.current)setLoading(true);
      const params=new URLSearchParams({limit:'100',offset:String(pageOffset),archived:String(includeArchived)});if(filter!=='all')params.set('status',filter);if(serverSearch)params.set('q',serverSearch);
      const response=await fetch(`/api/admin/bookings?${params}`,{signal:abort.signal,cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);
      const data:Booking[]=result.bookings;
      const card=activeCard.current;
      const refreshedCard=card&&!data.some(b=>b.id===card.id)?(await getBookings(abort.signal,`id=${encodeURIComponent(card.id)}&archived=true`))[0]:null;
      if(seq!==loadSequence.current)return;
      // Сортировка: ожидающие оплаты сначала, затем по времени слота.
      data.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        const tA = a.slot_time ? new Date(a.slot_time).getTime() : Infinity;
        const tB = b.slot_time ? new Date(b.slot_time).getTime() : Infinity;
        return tA - tB;
      });
      setBookings(data);
      setCounts(result.counts);setNextOffset(result.next_offset);
      setSelectedBooking(p=>p?(data.find(b=>b.id===p.id)??(refreshedCard?.id===p.id?refreshedCard:p)):p);loadedOnce.current=true;setLoadError(false);
    } catch {if(!abort.signal.aborted&&seq===loadSequence.current){setLoadError(true);toast.error("Не удалось загрузить записи");}} finally {if(seq===loadSequence.current)setLoading(false);}
  }, [filter,includeArchived,pageOffset,serverSearch]);

  useEffect(() => { fetchBookings(); const i = setInterval(fetchBookings, 30000); return () => {clearInterval(i);loadAbort.current?.abort();}; }, [fetchBookings]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    if(updatingId)return;
    setUpdatingId(id); const prev = bookings;
    setBookings((p) => p.map((b) => b.id === id ? { ...b, status } : b));
    try {
      await patchBooking(id, status);
      await fetchBookings();setHistoryRevision(r=>r+1);
      toast.success(status === "completed" ? "Посещение засчитано" : "Статус обновлён");
    } catch (error) { setBookings(prev); toast.error(error instanceof Error ? error.message : "Не удалось обновить запись");throw error; }
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
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');if(action==='no_show')throw error; }
    finally { setUpdatingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch("/api/admin/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Не удалось удалить запись. Попробуйте ещё раз."); }
    setBookings(p => p.filter(b => b.id !== deleteTarget.id));
    setSelectedBooking(p=>p?.id===deleteTarget.id?null:p);
    toast.success("Запись архивирована. История сохранена.");
    void fetchBookings();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();if(adding)return;setAddError("");
    if (!newName.trim() || !newPhone.trim() || !newDate || !consentConfirmed) return;
    setAdding(true);
    try {
    const slotTime = moscowInputToISO(newDate, newTime);
    const payload={service_type: newService, slot_time: slotTime, client_name: newName, client_phone: newPhone, consent_confirmed: consentConfirmed,account_user_id:newAccountId,identity_confirmed:newIdentity};
    const signature=JSON.stringify(payload);if(createRequest.current.signature!==signature)createRequest.current={signature,key:crypto.randomUUID()};
    const bookingRes = await fetch("/api/admin/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...payload,request_key:createRequest.current.key}) });
    const bookingData = await bookingRes.json();
    if (!bookingRes.ok) { setAddError(bookingData.error || "Ошибка"); setAdding(false); return; }
    setShowAddForm(false); setNewName(""); setNewPhone(""); setNewDate(""); setNewTime("10:00"); setConsentConfirmed(false);setNewAccountId(null);setNewIdentity(false); setAdding(false); fetchBookings();
    toast.success("Запись создана");
    createRequest.current={signature:'',key:''};
    } catch { setAddError("Не удалось создать запись. Проверьте соединение."); }
    finally { setAdding(false); }
  };

  const openReschedule = async () => {
    if (!selectedBooking || !["bfm", "brt", "psychology"].includes(selectedBooking.service_type)) return;
    setRescheduling(true); setRescheduleSlotId("");setRescheduleReason('');
    try {
      const response = await fetch(`/api/slots?service_type=${selectedBooking.service_type}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить время");
      setRescheduleSlots(result.slots || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка расписания"); setRescheduling(false); }
  };

  const submitReschedule = async () => {
    if (!selectedBooking || !rescheduleSlotId||updatingId) return;
    setUpdatingId(selectedBooking.id);
    try {
      const response = await fetch("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedBooking.id, service_type: selectedBooking.service_type, slot_id: rescheduleSlotId,reason:rescheduleReason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось перенести запись");
      toast.success("Запись перенесена"); setRescheduling(false); await fetchBookings();setHistoryRevision(r=>r+1);
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

  const stats = counts;

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="admin-bookings-page min-h-screen bg-[var(--bs-background)]">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-8 py-3 sm:py-6">
        {/* Sticky header */}
        <div className="admin-bookings-toolbar sticky top-0 z-30 bg-[var(--bs-background)] backdrop-blur-xl pb-4 sm:pb-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
            <div><h2 className="text-xl font-semibold tracking-tight text-[var(--bs-foreground)]">Найти запись</h2><p className="text-sm text-[var(--bs-muted)] mt-1">Откройте карточку клиента для переноса, отмены и отметки посещения · Московское время</p></div>
            <div className="grid grid-cols-2 items-center gap-2 sm:flex">
              <AdminButton variant="primary" onClick={() => {setNewAccountId(null);setNewIdentity(false);setConsentConfirmed(false);setShowAddForm(true);}} className="flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4" /> Новая запись</AdminButton>
              <AdminButton variant="outline" onClick={fetchBookings} className="flex items-center gap-2 text-sm font-medium"><RefreshCw className="w-4 h-4" /> Обновить</AdminButton>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Ждут оплату", value: stats.pending, icon: AlertCircle, color: "text-[var(--bs-warning)] bg-[var(--bs-warning-bg)]" },
              { label: "Сегодня", value: stats.today, icon: Calendar, color: "text-[var(--bs-info)] bg-[var(--bs-info-bg)]" },
              { label: "На неделе", value: stats.week, icon: Clock, color: "text-[var(--bs-primary)] bg-[var(--bs-primary-soft)]" },
              { label: "Онлайн", value: stats.online, icon: Video, color: "text-[var(--bs-primary)] bg-[var(--bs-primary-soft)]" },
            ].map((s) => (
              <AdminCard key={s.label} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-[var(--bs-radius-card)] flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-xs text-[var(--bs-muted)]">{s.label}</p><p className="text-xl font-bold text-[var(--bs-foreground)]">{s.value}</p></div>
              </AdminCard>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--bs-muted)]" /><AdminInput type="search" aria-label="Поиск клиента по имени, телефону или email" placeholder="Имя, телефон или email" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
            <div className="flex flex-wrap gap-1 bg-[var(--bs-surface)] border border-[var(--bs-border)] rounded-[var(--bs-radius-card)] p-1">
              {[{ key: "all", label: "Все" }, { key: "pending", label: "Ждут оплату" }, { key: "confirmed", label: "Подтверждены" }, { key: "cancelled", label: "Отменены" }, { key: "completed", label: "Завершены" }].map((item) => (
                <AdminButton variant={filter === item.key ? 'primary' : 'ghost'} key={item.key} aria-pressed={filter === item.key} onClick={() => {setFilter(item.key as BookingStatus|'all');setPageOffset(0);}}
                  size="sm">{item.label}</AdminButton>
              ))}
            </div>
          </div>
        </div>

        {loadError && <AdminFeedback tone="destructive">Не удалось обновить записи. <AdminButton variant="ghost" type="button" onClick={fetchBookings}>Повторить загрузку</AdminButton></AdminFeedback>}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><label className="flex min-h-11 items-center gap-2"><AdminCheckbox checked={includeArchived} onChange={e=>{setIncludeArchived(e.target.checked);setPageOffset(0);}}/>Включить архив</label><span>Всего по фильтру: {counts.total} · на странице: {bookings.length}</span><AdminButton variant="outline" disabled={pageOffset===0} onClick={()=>setPageOffset(Math.max(0,pageOffset-100))} className="min-h-11">Предыдущие записи</AdminButton><AdminButton variant="outline" disabled={nextOffset===null} onClick={()=>nextOffset!==null&&setPageOffset(nextOffset)} className="min-h-11">Следующие записи</AdminButton></div>
        {/* Add modal */}
        {showAddForm && (
          <AdminModal title="Новая запись" onCancel={() => setShowAddForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-[var(--bs-surface)] rounded-[var(--bs-radius-overlay)] shadow-[var(--bs-shadow-sm)] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-[var(--bs-border)]">
                <div><h3 className="text-lg font-semibold text-[var(--bs-foreground)]">Новая запись</h3><p className="text-sm text-[var(--bs-muted)] mt-1">Заполните данные клиента</p></div>
                <AdminButton variant="ghost" size="icon" type="button" aria-label="Закрыть форму новой записи" onClick={() => setShowAddForm(false)} className="flex items-center justify-center"><X className="w-5 h-5 text-[var(--bs-muted)]" /></AdminButton>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <SchedulingClientPicker onSelect={c=>{setNewAccountId(c?.id??null);setNewIdentity(false);if(c){setNewName(c.display_name??'');setNewPhone(formatRussianPhoneInput(c.phone??''));}}}/>
                {newAccountId&&<label className="flex gap-3 text-xs"><AdminCheckbox required checked={newIdentity} onChange={e=>setNewIdentity(e.target.checked)}/>Личность клиента и принадлежность кабинета подтверждены</label>}
                <div className="space-y-3">
                  <AdminField id="booking-create-name" label="Имя клиента"><AdminInput id="booking-create-name" required placeholder="Анна Петрова" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full text-sm" /></AdminField>
                  <AdminField id="booking-create-phone" label="Телефон"><AdminInput id="booking-create-phone" required type="tel" placeholder="+7 (999) 123-45-67" value={newPhone} onChange={(e) => setNewPhone(formatRussianPhoneInput(e.target.value))} className="w-full text-sm" /></AdminField>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <AdminField id="booking-create-service" label="Услуга"><AdminSelect id="booking-create-service" value={newService} onChange={(e) => setNewService(e.target.value as ServiceType)} className="w-full text-sm">{SERVICE_TYPES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}</AdminSelect></AdminField>
                    <AdminField id="booking-create-date" label="Дата"><AdminInput id="booking-create-date" required type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full text-sm" /></AdminField>
                    <AdminField id="booking-create-time" label="Время"><AdminInput id="booking-create-time" required type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full text-sm" /></AdminField>
                  </div>
                  <label className="flex items-start gap-3 text-xs text-[var(--bs-muted)]"><AdminCheckbox checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} className="mt-0.5" /><span>Клиент дал согласие на обработку персональных данных и запись на услугу.</span></label>
                </div>
                {addError && <AdminFeedback tone="destructive">{addError}</AdminFeedback>}
                <AdminButton variant="primary" type="submit" disabled={adding} className="w-full text-sm font-medium flex items-center justify-center gap-2">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Создать запись</AdminButton>
              </form>
            </motion.div>
          </AdminModal>
        )}

        {/* Client details modal */}
        {selectedBooking && (
          <AdminModal title="Карточка клиента" onCancel={() => setSelectedBooking(null)}>
            <motion.section aria-labelledby="booking-detail-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="admin-booking-modal max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[var(--bs-radius-overlay)] bg-[var(--bs-surface)] shadow-[var(--bs-shadow-sm)] rounded-[var(--bs-radius-overlay)]">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--bs-border)] bg-[var(--bs-surface)] p-5 backdrop-blur-xl sm:p-6">
                <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--bs-primary)]">Карточка клиента</p><h2 id="booking-detail-title" className="text-xl font-bold text-[var(--bs-foreground)] sm:text-2xl">{selectedBooking.client_name}</h2><p className="mt-1 text-xs text-[var(--bs-muted)]">Заявка {selectedBooking.id.slice(0, 8)} · {format(selectedBooking.created_at, "dd.MM.yyyy, HH:mm")}</p></div>
                <AdminButton variant="ghost" size="icon" type="button" onClick={() => setSelectedBooking(null)} className="grid flex-none place-items-center" aria-label="Закрыть карточку"><X className="h-5 w-5" /></AdminButton>
              </header>
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <BookingHistory key={selectedBooking.id} id={selectedBooking.id} revision={`${selectedBooking.slot_time}:${selectedBooking.status}:${historyRevision}`}/>
                <div className="rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)] p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--bs-muted)]">Контакты</p><div className="space-y-3 text-sm"><a href={`tel:${selectedBooking.client_phone}`} className="flex items-center gap-2 font-medium text-[var(--bs-foreground)] hover:text-[var(--bs-primary)]"><Phone className="h-4 w-4" />{selectedBooking.client_phone}</a>{selectedBooking.client_email && <a href={`mailto:${selectedBooking.client_email}`} className="flex items-center gap-2 break-all text-[var(--bs-foreground)] hover:text-[var(--bs-primary)]"><Mail className="h-4 w-4 flex-none" />{selectedBooking.client_email}</a>}{selectedBooking.client_tg && <p className="flex items-center gap-2 text-[var(--bs-foreground)]"><MessageSquareText className="h-4 w-4" />{selectedBooking.client_tg}</p>}</div></div>
                <div className="rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)] p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--bs-muted)]">Услуга и статус</p><div className="space-y-2 text-sm"><p className="font-semibold text-[var(--bs-foreground)]">{TYPE_LABELS[selectedBooking.service_type] || selectedBooking.service_type}</p><p className="text-[var(--bs-muted)]">{STATUS_CONFIG[selectedBooking.status]?.label || selectedBooking.status}</p><p className="text-[var(--bs-muted)]">{selectedBooking.slot_time ? format(selectedBooking.slot_time, "dd.MM.yyyy, HH:mm") : "Время ещё не выбрано"}</p>{selectedBooking.booking_type && <p className="text-[var(--bs-muted)]">Формат: {selectedBooking.booking_type === "online" ? "онлайн" : "очно"}</p>}</div></div>
                <div className="rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)] p-4 sm:col-span-2"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--bs-muted)]">Запрос клиента</p><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--bs-foreground)]">{selectedBooking.notes || "Комментарий не оставлен."}</p></div>
                <div className="rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--bs-foreground)]"><UserRound className="h-4 w-4" />Личный кабинет</p><p className="text-xs leading-5 text-[var(--bs-muted)]">{selectedBooking.account_user_id ? "Заявка связана с аккаунтом клиента" : "Заявка отправлена без авторизации"}</p>
                  {!selectedBooking.account_user_id && <div className="mt-3 space-y-3">
                    <label className="block text-xs text-[var(--bs-foreground)]">Email аккаунта<AdminInput type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} className="mt-1 w-full text-sm" /></label>
                    <label className="block text-xs text-[var(--bs-foreground)]">Основание проверки личности<AdminInput value={linkReason} onChange={e => setLinkReason(e.target.value)} placeholder="Например, подтверждено клиентом на приёме" className="mt-1 w-full text-sm" /></label>
                    <label className="flex items-start gap-2 text-xs text-[var(--bs-muted)]"><AdminCheckbox checked={identityConfirmed} onChange={e => setIdentityConfirmed(e.target.checked)} />Личность проверена, клиент подтвердил принадлежность аккаунта</label>
                    <AdminButton variant="primary" type="button" disabled={!identityConfirmed || !linkEmail || linkReason.trim().length < 5 || !!updatingId} onClick={() => bookingAction('link_account')} className="min-h-11 w-full text-sm font-semibold">Привязать запись</AdminButton>
                  </div>}
                </div>
                <div className="rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] p-4"><p className="mb-2 text-sm font-semibold text-[var(--bs-foreground)]">Согласие на обработку</p><p className="text-xs leading-5 text-[var(--bs-muted)]">{selectedBooking.consent_at ? `Зафиксировано ${format(selectedBooking.consent_at, "dd.MM.yyyy, HH:mm")}${selectedBooking.consent_version ? ` · ${selectedBooking.consent_version}` : ""}` : "Сведения о согласии отсутствуют"}</p></div>
                {selectedBooking.room_id && <AdminButton variant="outline" type="button" onClick={() => { navigator.clipboard.writeText(selectedBooking.room_id!); toast.success("ID комнаты скопирован"); }} className="flex items-center justify-center gap-2 text-sm font-medium sm:col-span-2"><Copy className="h-4 w-4" />Скопировать ID комнаты</AdminButton>}
                {["bfm", "brt", "psychology"].includes(selectedBooking.service_type) && !["cancelled", "completed"].includes(selectedBooking.status) && (
                  <div className="rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] p-4 sm:col-span-2">
                    {!rescheduling ? <AdminButton variant="ghost" type="button" onClick={openReschedule} className="flex w-full items-center justify-center gap-2 text-sm font-semibold"><Calendar className="h-4 w-4" />Перенести запись</AdminButton> : <div className="space-y-3"><p className="text-xs">Старое время: {selectedBooking.slot_time?format(selectedBooking.slot_time,'dd.MM.yyyy HH:mm'):'—'} МСК · {selectedBooking.duration_minutes} мин</p><label className="block text-xs font-semibold text-[var(--bs-muted)]">Новое свободное время<AdminSelect value={rescheduleSlotId} onChange={(event) => setRescheduleSlotId(event.target.value)} className="mt-1 w-full text-sm"><option value="">Выберите дату и время</option>{rescheduleSlots.map((slot) => <option key={slot.id} value={slot.id}>{format(slot.slot_time, "dd.MM.yyyy, HH:mm")}</option>)}</AdminSelect></label><p className="text-xs text-[var(--bs-muted)]">Длительность и условия оплаты сохраняются. Старые напоминания отменяются, новые формируются для выбранного времени. Сообщение, уже отправляемое провайдером, не всегда можно отозвать.</p><label className="block text-xs">Причина переноса<AdminInput value={rescheduleReason} maxLength={500} onChange={e=>setRescheduleReason(e.target.value)} className="mt-1 min-h-11 w-full"/></label><div className="flex gap-2"><AdminButton variant="outline" type="button" onClick={() => setRescheduling(false)} className="flex-1 text-sm">Назад</AdminButton><AdminButton variant="primary" type="button" disabled={!rescheduleSlotId || updatingId === selectedBooking.id} onClick={submitReschedule} className="flex-1 text-sm font-semibold">Сохранить</AdminButton></div></div>}
                  </div>
                )}
              </div>
              <footer className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[var(--bs-border)] bg-[var(--bs-surface)] p-5 backdrop-blur-xl sm:p-6">
                {selectedBooking.attendance === 'absent' && <p className="text-sm text-[var(--bs-destructive)]">Клиент не пришёл — посещение не засчитано.</p>}
                {!['cancelled','completed'].includes(selectedBooking.status) && <AdminButton variant="destructive" type="button" disabled={!!updatingId} onClick={() => setActionConfirm({id:selectedBooking.id,status:'cancelled',name:selectedBooking.client_name})} className="w-full text-sm font-semibold">Отменить запись</AdminButton>}
                {selectedBooking.status === 'confirmed' && <>
                  <AdminButton variant="primary" type="button" disabled={!!updatingId||!!selectedBooking.slot_time&&Date.parse(selectedBooking.slot_time)>Date.now()} onClick={() => setActionConfirm({id:selectedBooking.id,status:'completed',name:selectedBooking.client_name})} className="w-full text-sm font-semibold">Приём состоялся — засчитать посещение</AdminButton>
                  <AdminButton variant="destructive" type="button" disabled={!!updatingId||!!selectedBooking.slot_time&&Date.parse(selectedBooking.slot_time)>Date.now()} onClick={() => setActionConfirm({id:selectedBooking.id,status:'no_show',name:selectedBooking.client_name})} className="w-full text-sm font-semibold">Клиент не пришёл</AdminButton>
                </>}
              </footer>
            </motion.section>
          </AdminModal>
        )}

        {actionConfirm&&<AdminConfirmDialog title={actionConfirm.status==='cancelled'?'Отменить запись?':actionConfirm.status==='no_show'?'Отметить неявку?':'Подтвердить посещение?'} confirmLabel="Подтвердить" pendingLabel="Сохранение…" onCancel={()=>setActionConfirm(null)} onConfirm={()=>actionConfirm.status==='no_show'?bookingAction('no_show'):updateStatus(actionConfirm.id,actionConfirm.status)}><p>{actionConfirm.name}</p><p>{actionConfirm.status==='cancelled'?'Запись и история сохранятся. Освободится только время, не занятое другими записями и перерывами. Возврат оплаты не выполняется автоматически.':actionConfirm.status==='no_show'?'Запись закроется как неявка. Посещение и бонусы не засчитываются. Факты оплаты сохраняются.':'Посещение будет засчитано в программе лояльности. Сам факт оплаты не изменяется.'}</p></AdminConfirmDialog>}
        {/* Delete modal */}
        {deleteTarget && (
          <AdminConfirmDialog title="Архивировать запись?" onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} confirmLabel="Архивировать" pendingLabel="Архивирование…">
            <p>{deleteTarget.client_name} • {deleteTarget.slot_time ? format(new Date(deleteTarget.slot_time), "d MMM, HH:mm", { locale: ru }) : ""}</p>
            <p>Запись исчезнет из рабочего списка. Данные клиента, время и история событий сохранятся.</p>
          </AdminConfirmDialog>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4 mt-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-[var(--bs-surface)] rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)]" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-32 bg-[var(--bs-surface-muted)] rounded" /><div className="h-3 w-24 bg-[var(--bs-surface-muted)] rounded" /></div>
                  <div className="flex gap-2"><div className="h-10 w-24 bg-[var(--bs-surface-muted)] rounded-[var(--bs-radius-card)]" /><div className="h-10 w-24 bg-[var(--bs-surface-muted)] rounded-[var(--bs-radius-card)]" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : loadError && bookings.length === 0 ? (
          <p className="py-10 text-center text-sm">Список записей недоступен. Повторите загрузку выше.</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 mt-4 bg-[var(--bs-surface)] rounded-[var(--bs-radius-card)] border border-[var(--bs-border)]">
            <div className="w-20 h-20 rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)] flex items-center justify-center mx-auto mb-5"><CalendarDays className="w-10 h-10 text-[var(--bs-muted)]" /></div>
            <h3 className="text-lg font-semibold text-[var(--bs-foreground)] mb-1">{bookings.length === 0 ? "Пока нет заявок" : "Ничего не найдено"}</h3>
            <p className="text-sm text-[var(--bs-muted)]">{bookings.length === 0 ? "Создайте первую запись" : "Попробуйте изменить фильтры"}</p>
            {bookings.length === 0 && <AdminButton variant="primary" onClick={() => setShowAddForm(true)} className="mt-4 text-sm font-medium inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Создать запись</AdminButton>}
          </div>
        ) : (
          <div className="space-y-8 mt-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="flex items-center gap-3 mb-4"><h2 className="text-lg font-semibold text-[var(--bs-foreground)]">{group}</h2><div className="h-px flex-1 bg-[var(--bs-surface-muted)]" /></div>
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
                          className="group cursor-pointer bg-[var(--bs-surface)] rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] shadow-[var(--bs-shadow-sm)] hover:shadow-[var(--bs-shadow-sm)] hover:border-[var(--bs-border)] transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--bs-primary)]">
                          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              {/* Avatar */}
                              <div className={`w-11 h-11 rounded-[var(--bs-radius-card)] flex items-center justify-center text-sm font-bold flex-shrink-0 ${b.status === "pending" ? "bg-[var(--bs-warning-bg)] text-[var(--bs-warning)]" : b.status === "confirmed" ? "bg-[var(--bs-success-bg)] text-[var(--bs-success)]" : b.status === "cancelled" ? "bg-[var(--bs-destructive-bg)] text-[var(--bs-destructive)]" : "bg-[var(--bs-surface-muted)] text-[var(--bs-muted)]"}`}>
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-[var(--bs-foreground)]">{b.client_name}</h3>
                                  <AdminBadge tone={b.status === "pending" ? "warning" : b.status === "confirmed" ? "success" : b.status === "cancelled" ? "destructive" : "neutral"}><Icon className="w-3 h-3" aria-hidden="true" />{status.label}</AdminBadge>
                                  <AdminBadge>{TYPE_LABELS[b.service_type] || b.service_type}</AdminBadge>
                                  {b.booking_type === "online" && <AdminBadge tone="info">Онлайн</AdminBadge>}
                                  {b.payment_status === "due" && <AdminBadge tone="warning">Оплата на приёме</AdminBadge>}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-[var(--bs-muted)]">
                                  <a href={`tel:${b.client_phone}`} className="flex items-center gap-1 hover:text-[var(--bs-primary)] transition-colors"><Phone className="w-3.5 h-3.5" />{b.client_phone}</a>
                                  {b.slot_time && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{format(new Date(b.slot_time), "HH:mm", { locale: ru })}</span>}
                                </div>
                                {b.room_id && <p className="mt-1 text-xs text-[var(--bs-muted)] font-mono cursor-pointer hover:text-[var(--bs-primary)]" onClick={() => { navigator.clipboard.writeText(b.room_id!); toast.success("ID комнаты скопирован"); }}>Комната: {b.room_id}</p>}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                              {b.status === "confirmed" && b.booking_type === "online" && b.room_id && (
                                <AdminButton variant="primary" onClick={(event) => { event.stopPropagation(); router.push(`/psychology/room?id=${b.room_id}&role=doctor`); }} className="text-sm font-medium flex items-center gap-2"><Video className="w-4 h-4" />Войти</AdminButton>
                              )}
                              {b.status === "pending" && <AdminButton variant="destructive" onClick={(event) => { event.stopPropagation();setActionConfirm({id:b.id,status:'cancelled',name:b.client_name}); }} disabled={updatingId === b.id} className="text-sm font-medium flex items-center gap-2"><X className="w-4 h-4" />Отменить</AdminButton>}
                              {b.status === "confirmed" && (
                                <AdminButton variant="primary" disabled={!!updatingId||!!b.slot_time&&Date.parse(b.slot_time)>Date.now()} onClick={(event) => { event.stopPropagation();setActionConfirm({id:b.id,status:'completed',name:b.client_name}); }} className="min-h-11 text-sm font-medium">Приём состоялся</AdminButton>
                              )}
                              {canDelete && (
                                <AdminButton variant="destructive" size="icon" onClick={(event) => { event.stopPropagation(); setDeleteTarget(b); }} className="flex items-center justify-center" aria-label="Архивировать запись" title="Архивировать"><X className="w-4 h-4" /></AdminButton>
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
