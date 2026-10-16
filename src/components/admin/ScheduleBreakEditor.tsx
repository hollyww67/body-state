'use client';
import type {Hours} from '@/lib/schedule-plan';
import {AdminButton,AdminInput} from '@/components/admin/ui';

export default function ScheduleBreakEditor({value,onChange,disabled=false}:{value:Hours['breaks'];onChange:(value:Hours['breaks'])=>void;disabled?:boolean}) {
  return <fieldset disabled={disabled} className="mt-3 space-y-2"><legend className="text-xs font-medium">Перерывы рабочего дня</legend>
    {value.map((b,i)=><div key={i} className="flex flex-wrap items-end gap-2">
      <label className="text-xs">Начало перерыва<AdminInput aria-label={`Начало перерыва ${i+1}`} type="time" value={b.start} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,start:e.target.value}:v))} className="mt-1"/></label>
      <label className="text-xs">Конец перерыва<AdminInput aria-label={`Конец перерыва ${i+1}`} type="time" value={b.end} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,end:e.target.value}:v))} className="mt-1"/></label>
      <AdminButton type="button" variant="outline" size="sm" onClick={()=>onChange(value.filter((_,j)=>i!==j))} aria-label={`Убрать перерыв ${i+1}`}>Убрать</AdminButton>
    </div>)}
    <AdminButton type="button" variant="outline" size="sm" disabled={value.length>=20} onClick={()=>onChange([...value,{start:'12:00',end:'13:00'}])}>Добавить перерыв в график</AdminButton>
    <p className="text-xs text-[var(--bs-muted)]">Перерывы должны находиться внутри рабочего дня и не пересекаться. Сервер проверяет эти условия перед применением.</p>
  </fieldset>;
}
