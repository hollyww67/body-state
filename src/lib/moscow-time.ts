import { TZDate, tz } from "@date-fns/tz";
import { format, type FormatOptions, isSameDay, isSameMonth, isSameWeek, addDays } from "date-fns";

export const MOSCOW_TIME_ZONE = "Europe/Moscow";
export const MOSCOW_CONTEXT = tz(MOSCOW_TIME_ZONE);
type Instant = Date | string | number;

/** Preserve the Moscow context when date-fns advances days/months (including DST abroad). */
export function moscowDate(value: Instant = Date.now()): TZDate {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new TZDate(moscowInputToISO(value, "00:00"), MOSCOW_TIME_ZONE);
  }
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "string" ? new Date(value).getTime() : value;
  return new TZDate(timestamp, MOSCOW_TIME_ZONE);
}

export function formatMoscow(value: Instant, pattern: string, options?: FormatOptions): string {
  return format(moscowDate(value), pattern, { ...options, in: MOSCOW_CONTEXT });
}

export function moscowDayKey(value: Instant = Date.now()): string {
  return formatMoscow(value, "yyyy-MM-dd");
}

/** HTML date/time inputs represent civil Moscow time, never browser-local time. */
export function moscowInputToISO(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new RangeError("Укажите корректные дату и время");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const value = TZDate.tz(MOSCOW_TIME_ZONE, year, month - 1, day, hours, minutes, 0, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) {
    throw new RangeError("Укажите корректную дату");
  }
  return new Date(value.getTime()).toISOString();
}

export function sameMoscowDay(a: Instant, b: Instant): boolean {
  return isSameDay(moscowDate(a), moscowDate(b), { in: MOSCOW_CONTEXT });
}

export function sameMoscowMonth(a: Instant, b: Instant): boolean {
  return isSameMonth(moscowDate(a), moscowDate(b), { in: MOSCOW_CONTEXT });
}

export function isMoscowToday(value: Instant, now: Instant = Date.now()): boolean {
  return sameMoscowDay(value, now);
}

export function isMoscowTomorrow(value: Instant, now: Instant = Date.now()): boolean {
  return sameMoscowDay(value, addDays(moscowDate(now), 1));
}

export function isThisMoscowWeek(value: Instant, now: Instant = Date.now()): boolean {
  // Preserve the bookings page's existing date-fns Sunday-start week definition.
  return isSameWeek(moscowDate(value), moscowDate(now), { in: MOSCOW_CONTEXT, weekStartsOn: 0 });
}
