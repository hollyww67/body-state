"use client";

import { useState, useEffect, useId } from "react";

interface Slot { id: string; slot_time: string; }
const dayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date(value));
const dayLabel = (value: string) => new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Moscow" });

export default function BookingCalendar({ serviceType, onSelect }: { serviceType: "bfm" | "brt" | "psychology"; onSelect: (slotId: string) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const dayId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setSelectedId(null);
    setSlots([]);
    void fetch(`/api/slots?service_type=${serviceType}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Schedule unavailable");
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const available: Slot[] = data.slots || [];
        setSlots(available);
        setSelectedDay(available[0] ? dayKey(available[0].slot_time) : "");
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [serviceType, attempt]);

  if (loading) return <p role="status" className="text-[var(--foreground-secondary)]">Загружаем расписание…</p>;
  if (error) return <div role="alert"><p>Не удалось загрузить расписание.</p><button type="button" className="ds-secondary-button mt-3" onClick={() => setAttempt((value) => value + 1)}>Попробовать ещё раз</button></div>;
  if (!slots.length) return <p className="text-[var(--foreground-secondary)]">Пока нет свободных окон. Загляните позже.</p>;

  const grouped = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.slot_time);
    grouped.set(key, [...(grouped.get(key) || []), slot]);
  }

  return <div className="space-y-4">
    <label htmlFor={dayId} className="block text-sm font-semibold">Дата приёма</label>
    <select id={dayId} value={selectedDay} onChange={(event) => { setSelectedDay(event.target.value); setSelectedId(null); }} className="min-h-12 w-full min-w-0 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-base text-[var(--foreground)]">
      {Array.from(grouped.entries()).map(([key, items]) => <option key={key} value={key}>{dayLabel(items[0].slot_time)}</option>)}
    </select>
    <p className="text-xs text-[var(--foreground-secondary)]">Время московское (UTC+3)</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Свободное время">
      {(grouped.get(selectedDay) || []).map((slot) => <button key={slot.id} type="button" aria-pressed={selectedId === slot.id} onClick={() => { setSelectedId(slot.id); onSelect(slot.id); }} className="min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors" style={{ background: selectedId === slot.id ? "var(--primary)" : "var(--input-bg)", color: selectedId === slot.id ? "white" : "var(--foreground)", borderColor: selectedId === slot.id ? "var(--primary)" : "var(--input-border)" }}>
        {new Date(slot.slot_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })}
      </button>)}
    </div>
  </div>;
}
