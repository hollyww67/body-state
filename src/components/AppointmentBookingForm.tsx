"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CreditCard, UserRound } from "lucide-react";
import BookingCalendar, { type BookingCalendarSlot } from "@/components/BookingCalendar";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
import PaymentOptionChoice, { type PaymentOption } from "@/components/PaymentOptionChoice";
import PromoCodeField, { type AppliedPromo } from "@/components/PromoCodeField";
import BookingReceipt from "@/components/BookingReceipt";
import TextField from "@/components/ui/TextField";
import { Button } from "@/components/ui/button";
import { formatRussianPhoneInput, russianPhoneDigits } from "@/lib/phone";
import { useAccountPrefill } from "@/lib/hooks/use-account-prefill";
import type { BookingJourney, JourneyService } from "@/lib/booking-journey";
import { trackFunnel } from "@/lib/funnel-analytics";
import "./booking-quiet.css";

export type BookingServiceOption = { id: JourneyService; title: string; description: string; price: number };
type Props = { service: JourneyService; price: number; programId?: number; programTitle?: string; serviceOptions?: BookingServiceOption[] };
type Step = 1 | 2 | 3 | 4;
type Attempt = { endpoint: string; body: string };
const labels = { bfm: "Физическая реабилитация", psychology: "Психологическая реабилитация", brt: "БРТ" };
const steps = ["Услуга", "Дата и время", "Контакты", "Подтверждение"];
const titles = ["Записаться на приём", "Когда вам удобно?", "Как с вами связаться?", "Проверьте данные"];

export default function AppointmentBookingForm({ service, price, programId, programTitle, serviceOptions }: Props) {
  const profile = useAccountPrefill();
  const id = useId();
  const [chosenService, setChosenService] = useState(service);
  const [step, setStep] = useState<Step>(1);
  const [selectedSlot, setSelectedSlot] = useState<BookingCalendarSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [option, setOption] = useState<PaymentOption>("online");
  const [format, setFormat] = useState<"online" | "offline">("offline");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoVersion, setPromoVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ summary: BookingJourney; accessToken: string } | null>(null);
  const lock = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const promoGeneration = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const contactFields = useRef<HTMLFieldSetElement>(null);
  const choices = serviceOptions?.length ? serviceOptions : [{ id: service, title: programTitle || labels[service], description: programTitle ? "Индивидуальная программа" : "Индивидуальный приём", price }];
  const choice = choices.find((item) => item.id === chosenService) || choices[0];
  const locked = busy || uncertain;
  const clearSlot = useCallback(() => setSelectedSlot(null), []);
  const loadingCalendar = useCallback((value: boolean) => setCalendarLoading(value), []);

  useEffect(() => {
    if (profile) {
      setName((value) => value || profile.display_name || "");
      setPhone((value) => value || (profile.phone ? formatRussianPhoneInput(profile.phone) : ""));
      setEmail((value) => value || profile.email || "");
    }
  }, [profile]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  function navigate(next: Step) {
    if (locked || next === step) return;
    setError("");
    if (next === 2) setCalendarLoading(true);
    setStep(next);
  }
  function chooseService(next: JourneyService) {
    if (locked || next === chosenService) return;
    setChosenService(next);
    setSelectedSlot(null);
    resetPromo();
    setFormat("offline");
    attempt.current = null;
    trackFunnel("service_selected", "form:" + next + ":");
  }
  function resetPromo() {
    setPromo(null);
    promoGeneration.current += 1;
    setPromoVersion(promoGeneration.current);
  }
  function validContacts() {
    const phoneValid = /^7\d{10}$/.test(russianPhoneDigits(phone));
    phoneInput.current?.setCustomValidity(phoneValid ? "" : "Введите полный российский номер телефона");
    if (!name.trim() || !phoneValid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !consent) {
      setError("Проверьте имя, телефон, email и согласие на обработку данных.");
      setStep(3);
      contactFields.current?.querySelector<HTMLInputElement>(":invalid")?.reportValidity();
      return false;
    }
    return true;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (step !== 4) {
      if (step === 1 && choice.price > 0) navigate(2);
      else if (step === 2 && selectedSlot && !calendarLoading) navigate(3);
      else if (step === 3 && validContacts()) navigate(4);
      return;
    }
    if (!attempt.current) {
      if (!validContacts()) return;
      if (!selectedSlot || new Date(selectedSlot.slot_time).getTime() <= Date.now()) {
        setSelectedSlot(null); setCalendarLoading(true); setStep(2); setError("Выберите доступное время: прежнее время уже прошло."); return;
      }
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const accessToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      attempt.current = {
        endpoint: "/api/book/" + chosenService,
        body: JSON.stringify({ slot_id: selectedSlot.id, client_name: name, client_phone: phone, client_email: email, consent, payment_option: option, booking_type: format, program_id: programId, promoCode: promo?.code, requestKey: crypto.randomUUID(), accessToken }),
      };
    }
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(attempt.current.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: attempt.current.body });
      const data = await response.json();
      if (response.status === 409) {
        attempt.current = null; setUncertain(false); setSelectedSlot(null); setCalendarLoading(true); setStep(2);
        setError(data.error || "Это время уже занято. Выберите другое — контакты сохранены.");
        return;
      }
      if (!response.ok) {
        if (response.status < 500) { attempt.current = null; setUncertain(false); setError(data.error || "Проверьте данные записи."); return; }
        throw new Error("BOOKING_OUTCOME_UNKNOWN");
      }
      if (!data.booking?.summary?.id || !data.booking.accessToken) throw new Error("BOOKING_OUTCOME_UNKNOWN");
      setSaved(data.booking); setUncertain(false);
      trackFunnel("booking_created", data.booking.id);
    } catch {
      setUncertain(true);
      setError("Не удалось получить подтверждение. Повторите подтверждение с теми же данными: сохранённая запись не будет продублирована.");
    } finally { setBusy(false); lock.current = false; }
  }

  if (saved) return <div className="qb-booking qb-success"><BookingReceipt initial={saved.summary} accessToken={saved.accessToken} /></div>;
  const slotLabel = selectedSlot ? new Date(selectedSlot.slot_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "long", timeStyle: "short" }) : "Время не выбрано";
  return <form className="qb-booking" onSubmit={submit} noValidate aria-label="Запись на приём" aria-busy={busy}>
    <ol className="qb-progress" aria-label="Шаги записи">{steps.map((label, index) => <li key={label} data-complete={index + 1 < step}>
      <button type="button" disabled={locked || index + 1 > step} aria-current={index + 1 === step ? "step" : undefined} onClick={() => navigate((index + 1) as Step)}>
        <span className="qb-progress-number">{index + 1 < step ? <Check size={15} aria-hidden="true" /> : index + 1}</span><span>{label}</span>
      </button>
    </li>)}</ol>
    <header className="qb-heading"><p className="qb-eyebrow">Шаг {step} из 4</p><h2 ref={heading} tabIndex={-1}>{titles[step - 1]}</h2><p>{["Выберите подходящую услугу", "Выберите дату и время приёма · время московское", "Укажите контакты для вашей записи", "Пожалуйста, убедитесь, что всё верно"][step - 1]}</p></header>

    {step === 1 && <fieldset className="qb-services" disabled={locked}><legend className="qb-sr-only">Выберите услугу</legend>{choices.map((item) => <label className="qb-service" key={item.id} data-selected={chosenService === item.id}>
      <span className="qb-service-top"><span className="qb-service-title">{item.title}</span><input type="radio" name={id + "-service"} value={item.id} checked={chosenService === item.id} onChange={() => chooseService(item.id)} /></span>
      <span className="qb-service-description">{item.description}</span><strong>{item.price.toLocaleString("ru-RU")} ₽</strong>
    </label>)}</fieldset>}
    {step === 2 && <BookingCalendar serviceType={chosenService} initialSlot={selectedSlot} onSelectionClear={clearSlot} onLoadingChange={loadingCalendar} onSelect={(_slotId, details) => { setSelectedSlot(details); attempt.current = null; trackFunnel("service_selected", "form:" + chosenService + ":" + (programId || "")); trackFunnel("slot_selected", details.id); }} />}

    <fieldset className="qb-contacts qb-pane" ref={contactFields} hidden={step !== 3} disabled={locked}>
      <legend className="qb-sr-only">Контактные данные</legend>
      {chosenService === "psychology" && <label className="qb-select-label">Формат встречи<select value={format} onChange={(event) => { const next = event.target.value as "online" | "offline"; setFormat(next); if (next === "online") setOption("online"); }}><option value="offline">Очно</option><option value="online">Онлайн</option></select></label>}
      <TextField label="Ваше имя" required autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <TextField label="Номер телефона" ref={phoneInput} required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { const next = formatRussianPhoneInput(event.target.value); event.currentTarget.setCustomValidity(/^7\d{10}$/.test(russianPhoneDigits(next)) ? "" : "Введите полный российский номер телефона"); setPhone(next); }} />
      <TextField label="Электронная почта" required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
      <PaymentOptionChoice value={option} onChange={(next) => { setOption(next); if (next === "at_appointment") resetPromo(); }} onlineOnly={chosenService === "psychology" && format === "online"} />
      {option === "online" && chosenService !== "brt" && <PromoCodeField key={chosenService + ":" + (programId || "") + ":" + promoVersion} serviceCode={programId ? "psychology_program" : chosenService} programId={programId} onChange={(next) => { if (promoGeneration.current === promoVersion && !lock.current && !attempt.current) setPromo(next); }} />}
      <PersonalDataConsent id={id + "-consent"} checked={consent} onChange={setConsent} />
    </fieldset>

    {step === 4 && <div className="qb-review">
      <section><div className="qb-review-title"><h3><CreditCard size={18} aria-hidden="true" />Услуга</h3><button type="button" disabled={locked} onClick={() => navigate(1)}>Изменить</button></div><p><strong>{choice.title}</strong></p><p>{selectedSlot?.duration_minutes} минут · {(promo?.total ?? choice.price).toLocaleString("ru-RU")} ₽</p></section>
      <section><div className="qb-review-title"><h3><CalendarDays size={18} aria-hidden="true" />Дата и время</h3><button type="button" disabled={locked} onClick={() => navigate(2)}>Изменить</button></div><p>{slotLabel} · Москва</p></section>
      <section><div className="qb-review-title"><h3><UserRound size={18} aria-hidden="true" />Ваши данные</h3><button type="button" disabled={locked} onClick={() => navigate(3)}>Изменить</button></div><p>{name}</p><p>{phone}</p><p className="qb-break">{email}</p><p>{chosenService === "psychology" && (format === "online" ? "Онлайн · " : "Очно · ")}{option === "online" ? "Оплата онлайн после сохранения записи" : "Оплата на приёме"}</p>{promo && <p>Промокод: {promo.code}</p>}<p className="qb-note">Согласие на обработку данных подтверждено.</p></section>
    </div>}
    {step === 4 && <p className="qb-note">{option === "online" ? "Сначала сохраним запись и временно закрепим время. Затем вы сможете перейти к оплате." : "Запись подтвердится после сохранения. Оплата — на приёме."}</p>}
    {error && <p className="qb-error" role="alert">{error}</p>}
    <footer className="qb-actions">
      {step > 1 && <Button variant="ghost" disabled={locked} onClick={() => navigate((step - 1) as Step)}><ArrowLeft size={17} aria-hidden="true" />Назад</Button>}
      <Button type="submit" className="qb-next" size="lg" loading={busy} disabled={choice.price <= 0 || (step === 2 && (!selectedSlot || calendarLoading))}>{step === 1 ? "Выбрать дату и время" : step === 3 ? "Проверить запись" : step === 4 ? uncertain ? "Повторить подтверждение" : "Подтвердить запись" : "Продолжить"}<ArrowRight size={17} aria-hidden="true" /></Button>
    </footer>
  </form>;
}
