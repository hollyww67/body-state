import type {WeekDay} from './schedule-plan';

/** PostgreSQL JSONB reorders object keys; dirty-state detection must not. */
export function templateEditSignature(value:{name:string;week:WeekDay[];horizon_days:number;active:boolean}) {
  return JSON.stringify({name:value.name.trim(),horizon_days:value.horizon_days,active:value.active,
    week:value.week.map(h=>h===null?null:{start:h.start,end:h.end,step:h.step,
      services:[...h.services].sort(),breaks:h.breaks.map(b=>({start:b.start,end:b.end}))})});
}
