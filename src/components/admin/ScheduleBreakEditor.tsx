'use client';
import type {Hours} from '@/lib/schedule-plan';

export default function ScheduleBreakEditor({value,onChange,disabled=false}:{value:Hours['breaks'];onChange:(value:Hours['breaks'])=>void;disabled?:boolean}) {
  return <fieldset disabled={disabled} className="mt-3 space-y-2"><legend className="text-xs font-medium">Перерывы рабочего дня</legend>
    {value.map((b,i)=><div key={i} className="flex flex-wrap items-end gap-2">
      <label className="text-xs">Начало перерыва<input aria-label={`Начало перерыва ${i+1}`} type="time" value={b.start} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,start:e.target.value}:v))} className="ml-2 min-h-11 rounded-xl border bg-white px-2"/></label>
      <label className="text-xs">Конец перерыва<input aria-label={`Конец перерыва ${i+1}`} type="time" value={b.end} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,end:e.target.value}:v))} className="ml-2 min-h-11 rounded-xl border bg-white px-2"/></label>
      <button type="button" onClick={()=>onChange(value.filter((_,j)=>i!==j))} className="min-h-11 rounded-xl border px-3 text-xs" aria-label={`Убрать перерыв ${i+1}`}>Убрать</button>
    </div>)}
    <button type="button" disabled={value.length>=20} onClick={()=>onChange([...value,{start:'12:00',end:'13:00'}])} className="min-h-11 rounded-xl border px-3 text-xs">Добавить перерыв в график</button>
    <p className="text-xs text-gray-500">Перерывы должны находиться внутри рабочего дня и не пересекаться. Сервер проверяет эти условия перед применением.</p>
  </fieldset>;
}
