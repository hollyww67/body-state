"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { getEditablePage, getPageDefaults } from "@/lib/editable-pages";
import AboutDocumentsEditor from "@/components/admin/AboutDocumentsEditor";

type ExistingPage = { title?: string; content?: string; meta_description?: string; meta_keywords?: string; is_active?: boolean };
type Feature = { label: string; value: string };

function parseObject(value?: string): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const source = parsed.copy && typeof parsed.copy === "object" ? parsed.copy as Record<string, unknown> : parsed;
    return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return { description: value }; }
}

export default function EditPageAdmin() {
  const router = useRouter();
  const slug = String(useParams().slug || "");
  const definition = useMemo(() => getEditablePage(slug), [slug]);
  const isNew = slug === "new";
  const defaults = useMemo(() => getPageDefaults(slug), [slug]);
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [title, setTitle] = useState(definition?.title || "");
  const [customSlug, setCustomSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    fetch(`/api/page-content/${encodeURIComponent(slug)}`).then(async (response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error((await response.json()).error || "Не удалось загрузить страницу");
      return response.json() as Promise<ExistingPage>;
    }).then((data) => {
      if (!data) return;
      setTitle(data.title || definition?.title || "");
      setMetaDescription(data.meta_description || "");
      setMetaKeywords(data.meta_keywords || "");
      setIsActive(data.is_active !== false);
      setValues((current) => ({ ...current, ...parseObject(data.content) }));
      try {
        const parsed = JSON.parse(data.content || "{}") as { features?: Feature[] };
        if (Array.isArray(parsed.features)) setFeatures(parsed.features.filter((item) => item && typeof item.label === "string" && typeof item.value === "string"));
      } catch { /* Legacy rich text is not JSON. */ }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки")).finally(() => setLoading(false));
  }, [definition?.title, isNew, slug]);

  const fields = definition?.fields || [
    { key: "subtitle", label: "Подзаголовок", defaultValue: "" },
    { key: "description", label: "Основной текст", defaultValue: "", multiline: true, rows: 10 },
  ];

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    const targetSlug = isNew ? customSlug.trim().toLowerCase() : slug;
    try {
      const content = definition ? JSON.stringify({ copy: values }) : slug === "about" ? (values.description || "") : JSON.stringify({ ...values, features: features.filter((item) => item.label.trim() || item.value.trim()) });
      const response = await fetch("/api/admin/pages", { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: targetSlug, title, content, meta_description: metaDescription, meta_keywords: metaKeywords, is_active: isActive }) });
      if (!response.ok) throw new Error((await response.json()).error || "Не удалось сохранить изменения");
      setSaved(true);
      if (isNew) router.push("/admin/pages");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка сохранения"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-5 text-sm md:p-8" style={{ color: "var(--foreground-secondary)" }}>Загружаем текст страницы…</div>;

  return <div className="admin-page-editor mx-auto max-w-5xl p-4 pb-28 md:p-8">
    <div className="mb-7 flex flex-wrap items-center gap-3"><Link href="/admin/pages" className="grid h-10 w-10 place-items-center rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}><ArrowLeft className="h-5 w-5" /></Link><div className="min-w-0 flex-1"><p className="text-xs font-medium" style={{ color: "var(--primary)" }}>{definition?.group || "Дополнительная страница"}</p><h1 className="truncate text-2xl font-semibold" style={{ color: "var(--foreground)" }}>{isNew ? "Новая страница" : definition?.title || title || slug}</h1>{definition && <code className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{definition.route}</code>}</div>{definition && <Link href={definition.route} target="_blank" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>Посмотреть <ArrowUpRight className="h-4 w-4" /></Link>}</div>

    {definition && <div className="admin-editor-note mb-6 rounded-2xl border p-4 text-sm leading-6">Редактируются только текстовые элементы. Кнопки, ссылки, формы и адаптивная верстка останутся работоспособными.</div>}
    {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {saved && <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Изменения сохранены и уже доступны на сайте.</div>}

    <form onSubmit={save} className="space-y-6">
      <section className="content-panel admin-editor-card space-y-5 rounded-[24px] p-5 md:p-7">
        <div><h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Содержимое</h2><p className="mt-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>{definition?.description || "Текст дополнительной страницы"}</p></div>
        {isNew && <label className="block"><span className="mb-2 block text-sm font-medium">Адрес страницы (латиницей)</span><input required pattern="[a-z0-9-]+" value={customSlug} onChange={(event) => setCustomSlug(event.target.value)} placeholder="new-page" className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label>}
        {!definition && <label className="block"><span className="mb-2 block text-sm font-medium">Заголовок страницы</span><input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label>}
        {fields.map((field) => <label key={field.key} className="block"><span className="mb-2 flex items-center justify-between gap-3 text-sm font-medium"><span>{field.label}</span>{definition && values[field.key] !== field.defaultValue && <button type="button" onClick={() => setValues((current) => ({ ...current, [field.key]: field.defaultValue }))} className="inline-flex items-center gap-1 text-xs font-normal" style={{ color: "var(--primary)" }}><RotateCcw className="h-3 w-3" />Вернуть исходный</button>}</span>{field.multiline ? <textarea rows={field.rows || 4} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="w-full resize-y rounded-xl border px-4 py-3 leading-6" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /> : <input value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} />}</label>)}
        {!definition && slug !== "about" && <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium">Информационные карточки</p><p className="mt-1 text-xs" style={{ color: "var(--foreground-secondary)" }}>Подпись и значение в каждой карточке</p></div><button type="button" onClick={() => setFeatures((current) => [...current, { label: "", value: "" }])} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--primary)" }}><Plus className="h-3.5 w-3.5" />Добавить</button></div><div className="space-y-3">{features.map((feature, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={`Подпись карточки ${index + 1}`} value={feature.label} onChange={(event) => setFeatures((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Подпись" className="rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }} /><input aria-label={`Значение карточки ${index + 1}`} value={feature.value} onChange={(event) => setFeatures((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="Значение" className="rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }} /><button type="button" onClick={() => setFeatures((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-11 place-items-center rounded-xl border text-red-500" style={{ borderColor: "var(--border)" }} aria-label="Удалить карточку"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}
      </section>

      <details className="content-panel admin-editor-card rounded-[24px] p-5 md:p-7"><summary className="cursor-pointer font-semibold" style={{ color: "var(--foreground)" }}>SEO и публикация</summary><div className="mt-5 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium">Описание для поисковых систем</span><textarea rows={3} maxLength={320} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label><label className="block"><span className="mb-2 block text-sm font-medium">Ключевые слова</span><input value={metaKeywords} onChange={(event) => setMetaKeywords(event.target.value)} className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label><label className="flex items-center gap-3"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" /><span className="text-sm">Опубликовать изменения</span></label></div></details>

      <div className="admin-editor-savebar sticky bottom-4 z-10 flex justify-end rounded-[20px] p-2"><button type="submit" disabled={saving} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-medium text-white shadow-xl disabled:opacity-60" style={{ background: "var(--primary)" }}><Save className="h-4 w-4" />{saving ? "Сохраняем…" : "Сохранить"}</button></div>
    </form>
    {slug === "about" && <AboutDocumentsEditor />}
  </div>;
}
