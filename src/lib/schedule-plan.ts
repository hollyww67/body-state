import { SERVICE_DURATION_MINUTES, type ServiceType } from '@/lib/slots';

export class ScheduleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Hours = { start: string; end: string; step: number; services: ServiceType[]; breaks: { start: string; end: string }[] };
export type WeekDay = Hours | null;
export type SchedulePlan = { dates: string[]; hours: Hours; reason: string };
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function validDay(value: unknown): string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) throw new ScheduleError('Некорректная дата');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ScheduleError('Некорректная дата');
  return value;
}
export function minutes(value: unknown): number {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ScheduleError('Время должно быть в формате ЧЧ:ММ');
  const [h, m] = value.split(':').map(Number); return h * 60 + m;
}
export function clock(value: number): string { return `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}`; }
export function moscowInstant(day: string, minute: number): string {
  return new Date(Date.parse(`${validDay(day)}T00:00:00+03:00`) + minute * 60_000).toISOString();
}
export function dayAfter(day: string, offset = 1): string {
  return new Date(Date.parse(`${validDay(day)}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0,10);
}
export function dateRange(from: string, to: string): string[] {
  validDay(from); validDay(to);
  const n = (Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000;
  if (n < 0 || n > 365) throw new ScheduleError('Выберите диапазон не более 366 дней');
  return Array.from({length:n+1},(_,i)=>dayAfter(from,i));
}
export function normalizeHours(input: unknown): Hours {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ScheduleError('Укажите рабочие часы');
  const h = input as Record<string,unknown>;
  const start=minutes(h.start), end=minutes(h.end),step=Number(h.step);
  if (start>=end || !Number.isInteger(step) || step<15 || step>240) throw new ScheduleError('Проверьте рабочий диапазон и шаг начал');
  if (!Array.isArray(h.services) || !h.services.length || h.services.some(s=>!['bfm','brt','psychology'].includes(String(s)))) throw new ScheduleError('Выберите направление');
  const services=[...new Set(h.services)] as ServiceType[];
  const raw=h.breaks??[];
  if (!Array.isArray(raw) || raw.length>20) throw new ScheduleError('Не более 20 перерывов в день');
  const breaks=raw.map(b=>{
    if (!b || typeof b!=='object') throw new ScheduleError('Некорректный перерыв');
    const a=minutes(b.start),z=minutes(b.end);
    if (a>=z || a<start || z>end) throw new ScheduleError('Перерыв должен находиться в рабочем диапазоне');
    return {start:clock(a),end:clock(z)};
  }).sort((a,b)=>a.start.localeCompare(b.start));
  if(breaks.some((b,i)=>i>0 && breaks[i-1].end>b.start)) throw new ScheduleError('Перерывы пересекаются');
  return {start:clock(start),end:clock(end),step,services,breaks};
}
export function normalizePlan(input: Record<string,unknown>): SchedulePlan {
  let dates: string[];
  if (input.dates !== undefined) {
    if(!Array.isArray(input.dates) || input.dates.length>366) throw new ScheduleError('Выберите не более 366 дат');
    dates=input.dates.map(validDay);
  } else dates=dateRange(String(input.from??''),String(input.to??''));
  const excluded=new Set(Array.isArray(input.excludeDates)?input.excludeDates.map(validDay):[]);
  const weekdays=input.weekdays;
  if(weekdays!==undefined && (!Array.isArray(weekdays) || weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))) throw new ScheduleError('Некорректные дни недели');
  dates=[...new Set(dates)].filter(d=>!excluded.has(d) && (!Array.isArray(weekdays)||weekdays.includes(new Date(`${d}T12:00Z`).getUTCDay()))).sort();
  if(!dates.length) throw new ScheduleError('Не выбрано ни одной даты');
  return {dates,hours:normalizeHours(input.hours),reason:typeof input.reason==='string'?input.reason.trim().slice(0,500):''};
}
export function generateStarts(plan: SchedulePlan) {
  const result:{day:string;service:ServiceType;time:string;duration:number}[]=[];
  for(const day of plan.dates) for(const service of plan.hours.services) {
    const duration=SERVICE_DURATION_MINUTES[service];
    for(let minute=minutes(plan.hours.start);minute+duration<=minutes(plan.hours.end);minute+=plan.hours.step) {
      if(plan.hours.breaks.some(b=>minute<minutes(b.end)&&minute+duration>minutes(b.start))) continue;
      result.push({day,service,time:moscowInstant(day,minute),duration});
      if(result.length>5000) throw new ScheduleError('За один раз можно обработать не более 5000 окон');
    }
  }
  return result;
}
