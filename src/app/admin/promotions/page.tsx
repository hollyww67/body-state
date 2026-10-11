"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

type Promotion = {
  id: string;
  title: string;
  summary: string;
  details: string;
  badge: string;
  image_url: string | null;
  cta_label: string;
  cta_url: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type PromotionForm = Omit<Promotion, "id" | "image_url" | "starts_at" | "ends_at"> & {
  image_url: string;
  starts_at: string;
  ends_at: string;
};

const emptyForm: PromotionForm = {
  title: "", summary: "", details: "", badge: "Акция", image_url: "",
  cta_label: "Записаться", cta_url: "/rehabilitation#booking",
  starts_at: "", ends_at: "", is_active: true,
};

function toLocalDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function payload(value: Promotion | PromotionForm) {
  return {
    title: value.title, summary: value.summary, details: value.details, badge: value.badge,
    imageUrl: value.image_url || null, ctaLabel: value.cta_label, ctaUrl: value.cta_url,
    startsAt: value.starts_at ? new Date(value.starts_at).toISOString() : null,
    endsAt: value.ends_at ? new Date(value.ends_at).toISOString() : null,
    isActive: value.is_active,
  };
}

const inputClass = "h-11 rounded-xl border bg-[var(--input-bg)] px-3";

export default function PromotionsAdminPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promotions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data.promotions || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить акции");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving("new");
    try {
      const response = await fetch("/api/admin/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(form)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) => [data.promotion, ...current]); setForm(emptyForm); toast.success("Акция добавлена");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось создать акцию"); }
    finally { setSaving(""); }
  };

  const updateItem = (id: string, patch: Partial<Promotion>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));

  const save = async (item: Promotion) => {
    setSaving(item.id);
    try {
      const response = await fetch("/api/admin/promotions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, ...payload(item) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      updateItem(item.id, data.promotion); toast.success("Акция сохранена");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить акцию"); }
    finally { setSaving(""); }
  };

  const formFields: Array<[keyof PromotionForm, string]> = [
    ["title", "Название"], ["summary", "Краткое описание"], ["badge", "Бейдж"],
    ["image_url", "Ссылка на изображение"], ["cta_label", "Текст кнопки"], ["cta_url", "Ссылка кнопки"],
  ];

  return <div className="admin-promotions-page mx-auto grid max-w-7xl gap-6 p-4 md:p-8">
    <div className="grid items-start gap-6 xl:grid-cols-[380px_1fr]">
      <form onSubmit={create} className="content-panel grid gap-4 rounded-[28px] p-5 xl:sticky xl:top-28">
        <div className="flex items-center gap-2 font-semibold"><Gift className="h-5 w-5 text-[var(--primary)]" />Новая акция</div>
        {formFields.map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm">{label}<input required={key === "title"} value={String(form[key])} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} /></label>)}
        <label className="grid gap-1.5 text-sm">Условия<textarea value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} className="min-h-28 rounded-xl border bg-[var(--input-bg)] p-3" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5 text-xs">Начало<input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} className={inputClass} /></label>
          <label className="grid gap-1.5 text-xs">Окончание<input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} className={inputClass} /></label>
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />Показывать на сайте сразу</label>
        <button disabled={saving === "new"} className="admin-primary-action justify-center"><Plus className="h-4 w-4" />Добавить акцию</button>
      </form>

      <section className="grid gap-4">
        {loading ? <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin" /> : items.map((item) => <article key={item.id} className="content-panel grid gap-4 rounded-[24px] p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs">Название<input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} className={`${inputClass} font-semibold`} /></label>
            <label className="grid gap-1.5 text-xs">Бейдж<input value={item.badge} onChange={(event) => updateItem(item.id, { badge: event.target.value })} className={inputClass} /></label>
          </div>
          <label className="grid gap-1.5 text-xs">Краткое описание<textarea value={item.summary} onChange={(event) => updateItem(item.id, { summary: event.target.value })} className="min-h-20 rounded-xl border bg-[var(--input-bg)] p-3" /></label>
          <label className="grid gap-1.5 text-xs">Условия<textarea value={item.details} onChange={(event) => updateItem(item.id, { details: event.target.value })} className="min-h-24 rounded-xl border bg-[var(--input-bg)] p-3" /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs">Изображение<input value={item.image_url || ""} onChange={(event) => updateItem(item.id, { image_url: event.target.value || null })} className={inputClass} /></label>
            <label className="grid gap-1.5 text-xs">Текст кнопки<input value={item.cta_label} onChange={(event) => updateItem(item.id, { cta_label: event.target.value })} className={inputClass} /></label>
            <label className="grid gap-1.5 text-xs">Ссылка кнопки<input value={item.cta_url} onChange={(event) => updateItem(item.id, { cta_url: event.target.value })} className={inputClass} /></label>
            <label className="grid gap-1.5 text-xs">Начало<input type="datetime-local" value={toLocalDate(item.starts_at)} onChange={(event) => updateItem(item.id, { starts_at: event.target.value || null })} className={inputClass} /></label>
            <label className="grid gap-1.5 text-xs">Окончание<input type="datetime-local" value={toLocalDate(item.ends_at)} onChange={(event) => updateItem(item.id, { ends_at: event.target.value || null })} className={inputClass} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => updateItem(item.id, { is_active: !item.is_active })} className="admin-secondary-action">{item.is_active ? "Показывается" : "Скрыта"}</button>
            <button type="button" onClick={() => void save(item)} disabled={saving === item.id} className="admin-primary-action"><Save className="h-4 w-4" />Сохранить</button>
          </div>
        </article>)}
      </section>
    </div>
  </div>;
}
