"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Edit3, FileText, Search, Settings2 } from "lucide-react";

type RecordRow = { slug: string; title: string; updated_at: string; is_active: boolean };
type CatalogItem = { slug: string; title: string; route: string; group: string; description: string; fields: unknown[]; record: RecordRow | null };
type ManagedItem = { title: string; route: string; adminRoute: string; group: string; description: string };
type Payload = { catalog: CatalogItem[]; managed: ManagedItem[]; custom: RecordRow[] };

export default function PagesAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/pages").then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || "Не удалось загрузить страницы");
      return response.json();
    }).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки"));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    if (!data || !needle) return data;
    const matches = (value: string) => value.toLocaleLowerCase("ru").includes(needle);
    return { ...data, catalog: data.catalog.filter((item) => matches(`${item.title} ${item.route} ${item.description}`)), managed: data.managed.filter((item) => matches(`${item.title} ${item.route} ${item.description}`)), custom: data.custom.filter((item) => matches(`${item.title} ${item.slug}`)) };
  }, [data, query]);

  if (error) return <div className="m-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 md:m-8">{error}</div>;
  if (!filtered) return <div className="p-5 text-sm md:p-8" style={{ color: "var(--foreground-secondary)" }}>Загружаем редактор страниц…</div>;

  return <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>Контент сайта</p><h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>Редактор страниц</h1><p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>Меняйте текст без вмешательства в код. Структура и дизайн страницы останутся защищены.</p></div>
      <label className="relative block w-full lg:w-80"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--foreground-secondary)" }} /><span className="sr-only">Найти страницу</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти страницу…" className="w-full rounded-2xl border py-3 pl-11 pr-4 text-sm outline-none focus:ring-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label>
    </div>

    <section><div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5" style={{ color: "var(--primary)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Тексты страниц</h2><span className="rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>{filtered.catalog.length}</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.catalog.map((item) => <article key={item.slug} className="content-panel flex min-h-52 flex-col rounded-[24px] p-5">
        <div className="mb-5 flex items-start justify-between gap-3"><div><p className="mb-1 text-xs font-medium" style={{ color: "var(--primary)" }}>{item.group}</p><h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{item.title}</h3><code className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{item.route}</code></div><span className="h-2.5 w-2.5 rounded-full" title={item.record ? "Есть сохранённые изменения" : "Используется исходный текст"} style={{ background: item.record ? "#22c55e" : "var(--border)" }} /></div>
        <p className="mb-5 flex-1 text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>{item.description}</p>
        {item.record?.updated_at && <p className="mb-3 text-xs" style={{ color: "var(--foreground-secondary)" }}>Изменено {new Date(item.record.updated_at).toLocaleString("ru-RU")}</p>}
        <div className="flex gap-2"><Link href={`/admin/pages/${item.slug}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white" style={{ background: "var(--primary)" }}><Edit3 className="h-4 w-4" />Редактировать</Link><Link href={item.route} target="_blank" className="inline-flex items-center justify-center rounded-xl border px-3" style={{ borderColor: "var(--border)", color: "var(--foreground)" }} aria-label={`Открыть ${item.title}`}><ArrowUpRight className="h-4 w-4" /></Link></div>
      </article>)}</div>
    </section>

    <section><div className="mb-4 flex items-center gap-2"><Settings2 className="h-5 w-5" style={{ color: "var(--primary)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Контент из других разделов</h2></div>
      <div className="grid gap-3 md:grid-cols-2">{filtered.managed.map((item) => <div key={`${item.adminRoute}-${item.title}`} className="content-panel flex items-center gap-4 rounded-2xl p-4"><div className="min-w-0 flex-1"><p className="font-medium" style={{ color: "var(--foreground)" }}>{item.title}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--foreground-secondary)" }}>{item.description}</p></div><Link href={item.adminRoute} className="inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>Управлять <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>)}</div>
    </section>
  </div>;
}
