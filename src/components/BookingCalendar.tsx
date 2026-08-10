"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Slot { id: string; slot_time: string; }

export default function BookingCalendar({ serviceType, onSelect }: { serviceType: "bfm" | "brt" | "psychology"; onSelect: (slotId: string) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/slots?service_type=${serviceType}`)
      .then((r) => r.json())
      .then((data) => { setSlots(data.slots || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serviceType]);

  if (loading) return <p style={{ color: 'var(--foreground-secondary)' }}>Загружаем расписание...</p>;
  if (slots.length === 0) return <p style={{ color: 'var(--foreground-secondary)' }}>Пока нет свободных окон. Загляните позже.</p>;

  const grouped = slots.reduce((acc, slot) => {
    const date = format(new Date(slot.slot_time), "d MMMM, EEEE", { locale: ru });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, daySlots]) => (
        <div key={date}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{date}</h4>
          <div className="flex flex-wrap gap-2">
            {daySlots.map((slot) => {
              const isSelected = selectedId === slot.id;
              return (
                <button
                  key={slot.id}
                  onClick={() => { setSelectedId(slot.id); onSelect(slot.id); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: isSelected ? 'var(--primary)' : 'var(--input-bg)',
                    color: isSelected ? 'white' : 'var(--foreground)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--input-border)',
                    borderWidth: 1,
                  }}
                >
                  {format(new Date(slot.slot_time), "HH:mm")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
