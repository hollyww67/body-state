"use client";

import { useState, useEffect, useId, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./booking-quiet.css";

export interface BookingCalendarSlot { id: string; slot_time: string; duration_minutes: number; }
type Props = {
  serviceType: "bfm" | "brt" | "psychology";
  onSelect: (slotId: string, slot: BookingCalendarSlot) => void;
  initialSlot?: BookingCalendarSlot | null;
  onSelectionClear?: () => void;
  onLoadingChange?: (loading: boolean) => void;
};
const dayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const dayLabel = (value: string) => new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Moscow" });

export default function BookingCalendar({ serviceType, onSelect, initialSlot, onSelectionClear, onLoadingChange }: Props) {
  const initial = useRef(initialSlot);
  const [slots, setSlots] = useState<BookingCalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [month, setMonth] = useState("");
  const headingId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setSelectedId(null); setSlots([]);
    onLoadingChange?.(true);
    void fetch("/api/slots?service_type=" + serviceType, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Schedule unavailable"); return response.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        const available: BookingCalendarSlot[] = (Array.isArray(data.slots) ? data.slots : []).filter((slot: BookingCalendarSlot) => new Date(slot.slot_time).getTime() > Date.now()).sort((a: BookingCalendarSlot, b: BookingCalendarSlot) => Date.parse(a.slot_time) - Date.parse(b.slot_time));
        const restored = available.find((slot) => slot.id === initial.current?.id);
        const day = restored ? dayKey(restored.slot_time) : available[0] ? dayKey(available[0].slot_time) : "";
        setSlots(available); setSelectedDay(day); setMonth(day.slice(0, 7)); setSelectedId(restored?.id || null);
        if (!restored) onSelectionClear?.();
      })
      .catch(() => { if (!controller.signal.aborted) { setError(true); onSelectionClear?.(); } })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); onLoadingChange?.(false); } });
    return () => controller.abort();
  }, [serviceType, attempt, onSelectionClear, onLoadingChange]);

  if (loading) return <p role="status" className="qb-calendar-message">Загружаем расписание…</p>;
  if (error) return <div className="qb-calendar-message" role="alert"><p>Не удалось загрузить расписание.</p><button type="button" className="qb-calendar-retry" onClick={() => setAttempt((value) => value + 1)}>Попробовать ещё раз</button></div>;
  if (!slots.length || !month) return <div className="qb-calendar-message"><p>Пока нет свободных окон.</p><button type="button" className="qb-calendar-retry" onClick={() => setAttempt((value) => value + 1)}>Обновить расписание</button></div>;

  const grouped = new Map<string, BookingCalendarSlot[]>();
  for (const slot of slots) { const day = dayKey(slot.slot_time); grouped.set(day, [...(grouped.get(day) || []), slot]); }
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const today = dayKey(new Date().toISOString());
  function changeMonth(offset: number) {
    const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
    setMonth(date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0"));
    setSelectedDay(""); setSelectedId(null); onSelectionClear?.();
  }
  return <div className="qb-calendar">
    <div className="qb-month">
      <div className="qb-month-heading"><button type="button" aria-label="Предыдущий месяц" disabled={month <= today.slice(0, 7)} onClick={() => changeMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button><h3 id={headingId} aria-live="polite">{first.toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" })}</h3><button type="button" aria-label="Следующий месяц" disabled={month >= dayKey(slots[slots.length - 1].slot_time).slice(0, 7)} onClick={() => changeMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button></div>
      <div className="qb-weekdays" aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="qb-days" role="group" aria-labelledby={headingId}>
        {Array.from({ length: leading }, (_, index) => <span key={"empty-" + index} aria-hidden="true" />)}
        {Array.from({ length: days }, (_, index) => { const day = month + "-" + String(index + 1).padStart(2, "0"); const available = day >= today && grouped.has(day); return <button key={day} type="button" disabled={!available} aria-label={dayLabel(day + "T12:00:00+03:00")} aria-pressed={day === selectedDay} aria-current={day === today ? "date" : undefined} onClick={() => { setSelectedDay(day); setSelectedId(null); onSelectionClear?.(); }}>{index + 1}</button>; })}
      </div>
      <p className="qb-note">Активны только даты со свободным временем · Москва (UTC+3)</p>
    </div>
    <div className="qb-times"><h3>Выберите время</h3>{!grouped.has(selectedDay) || !selectedDay.startsWith(month) ? <p className="qb-note">Выберите доступную дату.</p> : <div role="group" aria-label="Свободное время">{(grouped.get(selectedDay) || []).map((slot) => <button key={slot.id} type="button" aria-pressed={selectedId === slot.id} onClick={() => { setSelectedId(slot.id); onSelect(slot.id, slot); }}>{new Date(slot.slot_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })}</button>)}</div>}</div>
  </div>;
}
