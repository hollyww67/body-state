'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';

/** A date reference only: appointment availability is shown in the real calendar. */
export default function HealthcareMiniCalendar() {
  const [today] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date()));
  const [month, setMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
  const start = (month.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  function move(offset: number) {
    setMonth(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1, 12)));
  }
  return <section className="bs-card healthcare-mini-calendar" aria-label="Обзор месяца">
    <header><AdminButton size="icon" variant="outline" aria-label="Предыдущий месяц" onClick={() => move(-1)}><ChevronLeft size={16} aria-hidden="true" /></AdminButton><h3 aria-live="polite">{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</h3><AdminButton size="icon" variant="outline" aria-label="Следующий месяц" onClick={() => move(1)}><ChevronRight size={16} aria-hidden="true" /></AdminButton></header>
    <table><caption className="sr-only">Календарь месяца; выделена сегодняшняя дата по Москве</caption><thead><tr>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead><tbody>{Array.from({length: Math.ceil((start + count) / 7)}, (_, week) => <tr key={week}>{Array.from({length:7}, (_, weekday) => {
      const day = week * 7 + weekday - start + 1;
      const date = `${month.getUTCFullYear()}-${String(month.getUTCMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      return <td key={weekday}>{day > 0 && day <= count ? <span aria-current={date === today ? 'date' : undefined}>{day}</span> : null}</td>;
    })}</tr>)}</tbody></table>
  </section>;
}
