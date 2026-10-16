"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, HeartPulse, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {AdminButton,AdminCard,AdminEmptyState,AdminInput,AdminLoadingState,AdminPageHeader} from '@/components/admin/ui';

type PriceRow = { id?: string; code?: string; label: string; price: number; prefix?: string; stock?: number };
type PriceData = { services: PriceRow[]; psychology: PriceRow[]; products: PriceRow[] };

const SECTIONS: Array<{ key: keyof PriceData; title: string; description: string; icon: typeof Sparkles; kind: string }> = [
  { key: "services", title: "Основные услуги", description: "Физическая реабилитация, БРТ и комплексная программа", icon: Sparkles, kind: "service" },
  { key: "psychology", title: "Программы психологической реабилитации", description: "Стоимость каждой программы", icon: HeartPulse, kind: "psychology" },
  { key: "products", title: "Товары магазина", description: "Цены каталога и текущие остатки", icon: Boxes, kind: "product" },
];

export default function AdminPricesPage() {
  const [data, setData] = useState<PriceData>({ services: [], psychology: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/prices", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { toast.error("Не удалось загрузить цены"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changePrice = (section: keyof PriceData, id: string, value: string) => {
    setData((current) => ({ ...current, [section]: current[section].map((row) => (row.id || row.code) === id ? { ...row, price: Number(value) } : row) }));
  };

  const save = async (kind: string, row: PriceRow) => {
    const id = row.id || row.code || "";
    setSaving(`${kind}:${id}`);
    try {
      const response = await fetch("/api/admin/prices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, price: row.price }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Ошибка сохранения");
      toast.success(`Цена «${row.label}» обновлена`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить цену"); }
    finally { setSaving(""); }
  };

  return (
    <div className="admin-prices-page">
      <AdminPageHeader title="Управление всеми ценами" description="Изменения сразу применяются на сайте и перепроверяются сервером при оплате."><AdminButton variant="outline" onClick={load} disabled={loading}><RefreshCw size={16}/><span>Обновить</span></AdminButton></AdminPageHeader>

      {loading ? <AdminLoadingState>Загружаем прайс</AdminLoadingState> : SECTIONS.map((section) => {
        const Icon = section.icon;
        return <AdminCard key={section.key} className="mb-6"><header className="bs-toolbar mb-4"><Icon size={20}/><div><h3 className="bs-section-heading">{section.title}</h3><p className="bs-muted text-sm">{section.description}</p></div></header><div className="grid gap-4">{data[section.key].length ? data[section.key].map((row) => {
          const id = row.id || row.code || "";
          const busy = saving === `${section.kind}:${id}`;
          return <article key={id} className="grid gap-3 border-t border-[var(--bs-border)] pt-4 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center"><div className="min-w-0"><strong>{row.label}</strong><p className="bs-muted mt-1 text-xs">{row.prefix ? `Показывается с пометкой «${row.prefix}»` : row.stock !== undefined ? `Остаток: ${row.stock}` : "Точная стоимость"}</p></div><label><span className="sr-only">Цена: {row.label}</span><AdminInput type="number" min="0" max="10000000" step="1" className="bs-money" value={Number(row.price)} onChange={event=>changePrice(section.key,id,event.target.value)}/></label><AdminButton onClick={()=>save(section.kind,row)} loading={busy} aria-label={`Сохранить цену ${row.label}`}><Save size={16}/><span>Сохранить</span></AdminButton></article>;
        }) : <AdminEmptyState title="В этом разделе пока нет позиций" />}</div></AdminCard>;
      })}
    </div>
  );
}
