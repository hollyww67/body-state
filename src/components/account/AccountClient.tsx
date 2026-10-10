"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Ban, CalendarDays, CircleHelp, ClipboardList, Copy, Gift, KeyRound, Loader2, LockKeyhole, LogOut, Mail, MapPin, PackageCheck, Phone, RotateCcw, Save, User, UserPlus } from "lucide-react";
import TextField from "@/components/ui/TextField";
import { formatRussianPhoneInput } from "@/lib/phone";

type Booking = { id: string; service_type: string; status: string; created_at: string; slot_time?: string | null; payment_status?: string | null };
type Order = { id: string; status: string; total: number; items: Array<{ name?: string; quantity?: number }>; created_at: string };
type LoyaltyReward = { id: string; visits_required: number; discount_percent: number; code: string | null; redeemed_count: number; reserved_count: number; is_active: boolean };
type SuccessfulVisit = { id: string; service_code: string; source_type: "booking" | "payment_link"; completed_at: string };
type AccountData = { video_rooms?: { room_id: string; room_name: string; expires_at: string }[]; username: string; contact: string | null; display_name: string | null; email: string | null; phone: string | null; address: string | null; bookings: Booking[]; orders: Order[]; successful_visits: SuccessfulVisit[]; loyalty?: { visits: number; next_rule: { visits_required: number; discount_percent: number } | null; rewards: LoyaltyReward[] } };
type Mode = "login" | "register" | "forgot";

const SERVICES: Record<string, string> = { bfm: "Физическая реабилитация", brt: "Биорезонансная терапия", psychology: "Психологическая реабилитация", psychology_program: "Психологическая программа", program: "Программа восстановления", consultation: "Консультация" };
const STATUSES: Record<string, string> = { pending: "Ожидает оплаты", confirmed: "Подтверждено", paid: "Оплачено", completed: "Завершено", cancelled: "Отменено", failed: "Ошибка оплаты", refunded: "Возврат", shipped: "Отправлен", delivered: "Доставлен" };

export default function AccountClient() {
  const [data, setData] = useState<AccountData | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Array<{ id: string; slot_time: string }>>([]);
  const [newSlotId, setNewSlotId] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");

  const loadAccount = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    const account = response.ok ? await response.json() as AccountData : null;
    setData(account);
    if (account) {
      setProfileName(account.display_name || "");
      setProfileEmail(account.email || "");
      setProfilePhone(account.phone ? formatRussianPhoneInput(account.phone) : "");
      setProfileAddress(account.address || "");
    }
    setChecking(false);
  }, []);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage("");
    setMessageIsError(false);
    setPassword("");
    if (nextMode === "forgot") requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(mode === "forgot" ? "/api/account/password-reset/request" : `/api/account/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "forgot" ? { identity: username } : {
          username,
          password,
          ...(mode === "register" ? {
            display_name: displayName,
            email,
            consent,
          } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
      if (mode === "forgot") {
        setMessage(result.message || "Письмо отправлено");
        return;
      }
      await loadAccount();
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Не удалось выполнить запрос");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" });
    setData(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setConsent(false);
    selectMode("login");
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: profileName, email: profileEmail, phone: profilePhone, address: profileAddress }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить профиль");
      setProfileMessage("Профиль сохранён. Эти данные будут подставляться в формы и корзину.");
      await loadAccount();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Не удалось сохранить профиль");
    } finally {
      setProfileSaving(false);
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (!window.confirm("Отменить эту запись? Освободившееся время станет доступно другим клиентам.")) return;
    setBookingActionId(booking.id); setBookingMessage("");
    try {
      const response = await fetch("/api/account/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, service_type: booking.service_type, action: "cancel" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось отменить запись");
      setBookingMessage("Запись отменена."); await loadAccount();
    } catch (error) { setBookingMessage(error instanceof Error ? error.message : "Не удалось отменить запись"); }
    finally { setBookingActionId(null); }
  };

  const startReschedule = async (booking: Booking) => {
    setBookingActionId(booking.id); setBookingMessage(""); setNewSlotId("");
    try {
      const response = await fetch(`/api/slots?service_type=${booking.service_type}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить расписание");
      setAvailableSlots(result.slots || []); setRescheduleBookingId(booking.id);
    } catch (error) { setBookingMessage(error instanceof Error ? error.message : "Не удалось загрузить расписание"); }
    finally { setBookingActionId(null); }
  };

  const confirmReschedule = async (booking: Booking) => {
    if (!newSlotId) return;
    setBookingActionId(booking.id); setBookingMessage("");
    try {
      const response = await fetch("/api/account/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, service_type: booking.service_type, action: "reschedule", slot_id: newSlotId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось перенести запись");
      setBookingMessage("Запись перенесена. Новое время уже отображается в кабинете."); setRescheduleBookingId(null); await loadAccount();
    } catch (error) { setBookingMessage(error instanceof Error ? error.message : "Не удалось перенести запись"); }
    finally { setBookingActionId(null); }
  };

  if (checking) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" /></div>;

  if (!data) return (
    <section className="ds-auth-shell">
      <div className="ds-auth-intro">
        <span className="ds-kicker">Личный кабинет</span>
        <h1>{mode === "register" ? "Создайте своё пространство" : mode === "forgot" ? "Верните доступ" : "С возвращением"}</h1>
        <p>{mode === "register" ? "Создайте кабинет за минуту. После входа записи на физическую, психологическую реабилитацию и БРТ будут появляться здесь автоматически." : mode === "forgot" ? "Мы отправим безопасную одноразовую ссылку на e-mail, указанный при регистрации." : "Войдите по e-mail и паролю — без SMS и ожидания кода."}</p>
        <div className="ds-auth-benefits" aria-label="Возможности личного кабинета">
          <span><CalendarDays /> Записи и услуги</span>
          <span><PackageCheck /> История заказов</span>
          <span><LockKeyhole /> Защищённая сессия</span>
        </div>
      </div>

      <div className="ds-panel ds-auth-card">
        <div className="ds-auth-icon">{mode === "register" ? <UserPlus /> : mode === "forgot" ? <Mail /> : <LockKeyhole />}</div>
        {mode !== "forgot" && <div className="ds-tabs" role="tablist" aria-label="Режим входа">
          {(["login", "register"] as Mode[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => selectMode(item)}>
              {item === "login" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>}

        {mode === "forgot" && <button type="button" className="ds-auth-back" onClick={() => selectMode("login")}><ArrowLeft /> Вернуться ко входу</button>}

        <form onSubmit={submit} className="mt-6 space-y-5">
          {mode === "register" && <TextField label="Ваше имя" icon={<User />} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} required />}
          {mode === "register" && <TextField label="E-mail" icon={<Mail />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" hint="Нужен для восстановления доступа и уведомлений" required />}
          {mode !== "register" && <TextField label="E-mail" icon={<Mail />} type="email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" maxLength={254} spellCheck={false} hint={mode === "forgot" ? "Мы не сообщаем, существует ли такой аккаунт" : undefined} required />}
          {mode !== "forgot" && <TextField label="Пароль" icon={<KeyRound />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={10} hint={mode === "register" ? "Не менее 10 символов, минимум одна буква и одна цифра" : undefined} required />}

          {mode === "register" && (
            <label className="ds-consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
              <span>Я согласен(на) на обработку данных для создания кабинета. <Link href="/personal-data-consent" target="_blank">Согласие</Link> · <Link href="/privacy" target="_blank">Политика</Link></span>
            </label>
          )}

          {message && <p role="status" className={`ds-alert${messageIsError ? " is-error" : ""}`}>{message}</p>}
          <button type="submit" disabled={loading || (mode === "register" && !consent)} className="ds-primary-button">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "register" ? "Создать кабинет" : mode === "forgot" ? "Отправить ссылку" : "Войти"}
          </button>
          {mode === "login" && <button type="button" className="ds-auth-help" onClick={() => selectMode("forgot")}><CircleHelp /> Забыли пароль? Восстановить по e-mail</button>}
        </form>
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><span className="ds-kicker">Личный кабинет</span><h1 className="mt-2 text-3xl font-semibold">{data.display_name ? `${data.display_name}, ваши услуги` : "Мои услуги"}</h1><p className="mt-1 text-sm text-[var(--foreground-secondary)]">{data.email}</p></div>
        <button onClick={logout} className="ds-secondary-button"><LogOut className="h-4 w-4" /> Выйти</button>
      </div>
      {!!data.video_rooms?.length && <section className="ds-panel mb-6 p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Онлайн-консультации</h2>
        <p className="mt-2 text-sm text-[var(--foreground-secondary)]">Для записи вход открывается за 15 минут до приёма. Заранее разрешите браузеру доступ к камере и микрофону.</p>
        <div className="mt-4 grid gap-3">{data.video_rooms.map(room=><div key={room.room_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><span>{room.room_name}</span><Link href={'/psychology/room?id='+room.room_id} className="ds-primary-button">Открыть видеокомнату</Link></div>)}</div>
      </section>}
      {data.loyalty && <section className="ds-panel mb-6 overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-muted)] text-[var(--primary)]"><Award className="h-5 w-5" /></span><div><p className="ds-kicker">Программа лояльности</p><h2 className="mt-1 text-xl font-semibold">{data.loyalty.visits} успешных приёмов</h2><p className="mt-1 text-sm text-[var(--foreground-secondary)]">Завершённые процедуры учитываются автоматически.</p></div></div>
          {data.loyalty.next_rule ? <div className="rounded-2xl bg-[var(--primary-muted)] px-4 py-3 text-sm"><b>До скидки {Number(data.loyalty.next_rule.discount_percent)}%</b><span className="mt-1 block text-[var(--foreground-secondary)]">ещё {Math.max(0, Number(data.loyalty.next_rule.visits_required)-data.loyalty.visits)} приёмов</span></div> : <div className="rounded-2xl bg-[var(--primary-muted)] px-4 py-3 text-sm font-semibold">Все уровни достигнуты</div>}
        </div>
        {data.loyalty.next_rule && <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--input-bg)]"><div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${Math.min(100, data.loyalty.visits / Number(data.loyalty.next_rule.visits_required) * 100)}%` }} /></div>}
        {data.loyalty.rewards.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.loyalty.rewards.map((reward) => { const available=Boolean(reward.code && reward.is_active && Number(reward.redeemed_count)===0 && Number(reward.reserved_count)===0); return <article key={reward.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4 text-[var(--primary)]" />Скидка {Number(reward.discount_percent)}%</div><p className="mt-1 text-xs text-[var(--foreground-secondary)]">Награда за {reward.visits_required} приёмов</p>{available ? <button type="button" onClick={() => void navigator.clipboard.writeText(reward.code!)} className="ds-secondary-button mt-3 w-full"><Copy className="h-4 w-4" />{reward.code}</button> : <p className="mt-3 text-sm font-medium text-[var(--foreground-secondary)]">Промокод использован</p>}</article>; })}</div>}
      </section>}
      <section className="ds-panel mb-10 p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary-muted)] text-[var(--primary)]"><User className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold">Профиль и доставка</h2><p className="mt-1 text-sm text-[var(--foreground-secondary)]">Заполним формы и корзину автоматически.</p></div></div>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Имя и фамилия" icon={<User />} value={profileName} onChange={(event) => setProfileName(event.target.value)} autoComplete="name" required />
          <TextField label="E-mail" icon={<Mail />} type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} autoComplete="email" />
          <TextField label="Телефон" icon={<Phone />} type="tel" value={profilePhone} onChange={(event) => setProfilePhone(formatRussianPhoneInput(event.target.value))} autoComplete="tel" inputMode="tel" />
          <TextField label="Адрес доставки" icon={<MapPin />} value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} autoComplete="street-address" placeholder="Город, улица, дом, квартира" />
          {profileMessage && <p role="status" className="ds-alert sm:col-span-2">{profileMessage}</p>}
          <button type="submit" disabled={profileSaving} className="ds-primary-button sm:col-span-2 sm:w-fit"><Save className="h-4 w-4" />{profileSaving ? "Сохраняем…" : "Сохранить профиль"}</button>
        </form>
      </section>
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><ClipboardList className="h-5 w-5 text-[var(--primary)]" />Записи и заявки</h2>
        {bookingMessage && <p role="status" className="ds-alert mb-4">{bookingMessage}</p>}
        <div className="grid gap-3">{data.bookings.length ? data.bookings.map((item) => {
          const canManage = Boolean(item.slot_time) && ["bfm", "brt", "psychology"].includes(item.service_type) && !["cancelled", "completed"].includes(item.status);
          // Full saved receipt is served only after the account ownership check.
          return <article key={`${item.service_type}-${item.id}`} className="ds-panel p-5">
            {item.slot_time&&['bfm','brt','psychology'].includes(item.service_type)&&<Link href={`/booking/${item.service_type}/${item.id}`} className="ds-secondary-button mb-3 min-h-11">Детали записи и календарь</Link>}
            <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-semibold">{SERVICES[item.service_type] || item.service_type}</h3><p className="mt-1 text-sm text-[var(--foreground-secondary)]">{item.slot_time ? new Date(item.slot_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : `Заявка от ${new Date(item.created_at).toLocaleDateString("ru-RU")}`}</p></div><span className="text-sm font-medium text-[var(--primary)]">{["cancelled", "completed"].includes(item.status) ? STATUSES[item.status] : item.payment_status === "due" ? "Подтверждено · оплата на приёме" : STATUSES[item.status] || item.status}</span></div>
            {canManage && rescheduleBookingId !== item.id && <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={bookingActionId === item.id} onClick={() => void startReschedule(item)} className="ds-secondary-button"><RotateCcw className="h-4 w-4" />Перенести</button><button type="button" disabled={bookingActionId === item.id} onClick={() => void cancelBooking(item)} className="ds-secondary-button text-red-600"><Ban className="h-4 w-4" />Отменить</button></div>}
            {rescheduleBookingId === item.id && <div className="mt-4 rounded-2xl bg-[var(--input-bg)] p-4"><label className="mb-2 block text-sm font-medium">Новое свободное время</label><select value={newSlotId} onChange={(event) => setNewSlotId(event.target.value)} className="h-12 w-full rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4"><option value="">Выберите дату и время</option>{availableSlots.map((slot) => <option key={slot.id} value={slot.id}>{new Date(slot.slot_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</option>)}</select><div className="mt-3 flex gap-2"><button type="button" onClick={() => setRescheduleBookingId(null)} className="ds-secondary-button flex-1">Назад</button><button type="button" disabled={!newSlotId || bookingActionId === item.id} onClick={() => void confirmReschedule(item)} className="ds-primary-button flex-1">Сохранить</button></div></div>}
          </article>;
        }) : <p className="ds-empty-state">Записей пока нет. Новая заявка появится здесь сразу после отправки.</p>}</div>
      </section>
      {data.successful_visits?.length > 0 && <section className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Award className="h-5 w-5 text-[var(--primary)]" />История успешных посещений</h2>
        <div className="grid gap-3 sm:grid-cols-2">{data.successful_visits.map((visit) => <article key={visit.id} className="ds-panel p-5">
          <h3 className="font-semibold">{SERVICES[visit.service_code] || visit.service_code}</h3>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{new Date(visit.completed_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</p>
          <span className="mt-3 inline-flex rounded-full bg-[var(--primary-muted)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">{visit.source_type === "payment_link" ? "Оплачено по персональной ссылке" : "Приём завершён"}</span>
        </article>)}</div>
      </section>}
      <section className="mt-10"><h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><PackageCheck className="h-5 w-5 text-[var(--primary)]" />Заказы</h2><div className="grid gap-3">{data.orders.length ? data.orders.map((order) => <article key={order.id} className="ds-panel p-5"><div className="flex justify-between gap-4"><div><h3 className="font-semibold">Заказ {order.id.slice(0, 8)}</h3><p className="mt-1 text-sm text-[var(--foreground-secondary)]">{(order.items || []).map((item) => `${item.name || "Позиция"} × ${item.quantity || 1}`).join(", ")}</p><p className="mt-2 font-semibold">{Number(order.total).toLocaleString("ru-RU")} ₽</p></div><span className="text-sm font-medium text-[var(--primary)]">{STATUSES[order.status] || order.status}</span></div></article>) : <p className="ds-empty-state">Заказов пока нет. Новые покупки автоматически появятся здесь.</p>}</div></section>
    </div>
  );
}
