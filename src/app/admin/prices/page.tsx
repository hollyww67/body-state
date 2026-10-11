"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeRussianRuble, Boxes, HeartPulse, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
      <header className="admin-page-intro">
        <div><p className="admin-section-eyebrow">Единый прайс</p><h2>Управление всеми ценами</h2><p>Изменения сразу применяются на сайте и перепроверяются сервером при оплате.</p></div>
        <button type="button" onClick={load} className="admin-dashboard-refresh" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span>Обновить</span></button>
      </header>

      {loading ? <div className="admin-list-empty"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Загружаем прайс</div> : SECTIONS.map((section) => {
        const Icon = section.icon;
        return <section key={section.key} className="admin-price-section"><header><span><Icon className="h-5 w-5" /></span><div><h3>{section.title}</h3><p>{section.description}</p></div></header><div className="admin-price-list">{data[section.key].length ? data[section.key].map((row) => {
          const id = row.id || row.code || "";
          const busy = saving === `${section.kind}:${id}`;
          return <article key={id} className="admin-price-row"><div className="admin-price-copy"><strong>{row.label}</strong><small>{row.prefix ? `Показывается с пометкой «${row.prefix}»` : row.stock !== undefined ? `Остаток: ${row.stock}` : "Точная стоимость"}</small></div><label><span className="sr-only">Цена: {row.label}</span><BadgeRussianRuble className="h-4 w-4" /><input type="number" min="0" max="10000000" step="1" value={Number(row.price)} onChange={(event) => changePrice(section.key, id, event.target.value)} /></label><button type="button" onClick={() => save(section.kind, row)} disabled={busy} aria-label={`Сохранить цену ${row.label}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span>Сохранить</span></button></article>;
        }) : <p className="admin-list-empty">В этом разделе пока нет позиций.</p>}</div></section>;
      })}
    </div>
  );
}
