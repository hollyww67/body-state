"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import {AdminBadge,AdminButton,AdminCard,AdminEmptyState,AdminInput,AdminLoadingState,AdminPageHeader} from '@/components/admin/ui';

type Rule={id:string;visits_required:number;discount_percent:number;is_active:boolean};

export default function LoyaltyAdminPage(){
  const [rules,setRules]=useState<Rule[]>([]); const [visits,setVisits]=useState("10"); const [discount,setDiscount]=useState("10"); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState("");
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/admin/loyalty",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setRules(d.rules||[]);}catch(e){toast.error(e instanceof Error?e.message:"Ошибка загрузки");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const create=async(e:React.FormEvent)=>{e.preventDefault();setSaving("new");try{const r=await fetch("/api/admin/loyalty",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({visitsRequired:Number(visits),discountPercent:Number(discount)})});const d=await r.json();if(!r.ok)throw new Error(d.error);setRules(c=>[...c,d.rule].sort((a,b)=>a.visits_required-b.visits_required));toast.success("Уровень добавлен");}catch(e){toast.error(e instanceof Error?e.message:"Ошибка");}finally{setSaving("");}};
  const update=async(rule:Rule)=>{setSaving(rule.id);try{const r=await fetch("/api/admin/loyalty",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:rule.id,visitsRequired:Number(rule.visits_required),discountPercent:Number(rule.discount_percent),isActive:rule.is_active})});const d=await r.json();if(!r.ok)throw new Error(d.error);setRules(c=>c.map(x=>x.id===rule.id?d.rule:x).sort((a,b)=>a.visits_required-b.visits_required));toast.success("Правило сохранено");}catch(e){toast.error(e instanceof Error?e.message:"Ошибка");}finally{setSaving("");}};
  return <div className="bs-page">
    <AdminPageHeader title="Программа лояльности" description="Настройте, после какого количества успешных приёмов выдаётся одноразовая персональная скидка."/>
    <div className="bs-split"><form onSubmit={create} className="bs-form">
      <div className="bs-toolbar"><Award size={24}/><h2 className="bs-section-heading">Новый уровень</h2></div>
      <label>Количество приёмов<AdminInput type="number" min="1" required value={visits} onChange={e=>setVisits(e.target.value)}/></label>
      <label>Скидка, %<AdminInput type="number" min="1" max="99" step="0.01" required value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
      <AdminButton type="submit" disabled={saving==='new'}><Plus size={16}/>Добавить уровень</AdminButton>
    </form><section className="grid min-w-0 gap-4" aria-label="Уровни лояльности">
      {loading?<AdminLoadingState/>:rules.length===0?<AdminEmptyState title="Уровней пока нет"/>:rules.map(rule=><AdminCard key={rule.id} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Приёмов<AdminInput type="number" min="1" value={rule.visits_required} onChange={e=>setRules(c=>c.map(x=>x.id===rule.id?{...x,visits_required:Number(e.target.value)}:x))}/></label>
        <label className="grid gap-2 text-sm">Скидка, %<AdminInput type="number" min="1" max="99" value={rule.discount_percent} onChange={e=>setRules(c=>c.map(x=>x.id===rule.id?{...x,discount_percent:Number(e.target.value)}:x))}/></label>
        <div className="bs-toolbar sm:col-span-2"><AdminBadge tone={rule.is_active?'success':'neutral'}>{rule.is_active?'Активен':'Отключён'}</AdminBadge><AdminButton variant="outline" onClick={()=>setRules(c=>c.map(x=>x.id===rule.id?{...x,is_active:!x.is_active}:x))}>{rule.is_active?'Отключить':'Включить'}</AdminButton><AdminButton onClick={()=>void update(rule)} disabled={saving===rule.id} aria-label={`Сохранить уровень ${rule.visits_required} приёмов`}><Save size={16}/>Сохранить</AdminButton></div>
      </AdminCard>)}
    </section></div>
  </div>;
}
