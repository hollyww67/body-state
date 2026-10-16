"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Edit3, FileText, Search, Settings2 } from "lucide-react";
import { AdminBadge, AdminCard, AdminFeedback, AdminInput } from "@/components/admin/ui";

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

  if (error) return <div className="m-4 md:m-8"><AdminFeedback tone="destructive">{error}</AdminFeedback></div>;
  if (!filtered) return <div className="p-5 text-sm md:p-8" style={{ color: "var(--bs-muted)" }}>Загружаем редактор страниц…</div>;

  return <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--bs-primary)" }}>Контент сайта</p><h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--bs-foreground)" }}>Редактор страниц</h1><p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--bs-muted)" }}>Меняйте текст без вмешательства в код. Структура и дизайн страницы останутся защищены.</p></div>
      <label className="relative block w-full lg:w-80"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--bs-muted)" }} /><span className="sr-only">Найти страницу</span><AdminInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти страницу…" style={{ paddingLeft: 44 }} /></label>
    </div>

    <section><div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5" style={{ color: "var(--bs-primary)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--bs-foreground)" }}>Тексты страниц</h2><AdminBadge>{filtered.catalog.length}</AdminBadge></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.catalog.map((item) => <AdminCard key={item.slug} className="flex min-h-52 flex-col p-5">
        <div className="mb-5 flex items-start justify-between gap-3"><div><p className="mb-1 text-xs font-medium" style={{ color: "var(--bs-primary)" }}>{item.group}</p><h3 className="text-lg font-semibold" style={{ color: "var(--bs-foreground)" }}>{item.title}</h3><code className="text-xs" style={{ color: "var(--bs-muted)" }}>{item.route}</code></div><span className="h-2.5 w-2.5 shrink-0 rounded-full" title={item.record ? "Есть сохранённые изменения" : "Используется исходный текст"} style={{ background: item.record ? "var(--bs-success)" : "var(--bs-border)" }} /></div>
        <p className="mb-5 flex-1 text-sm leading-6" style={{ color: "var(--bs-muted)" }}>{item.description}</p>
        {item.record?.updated_at && <p className="mb-3 text-xs" style={{ color: "var(--bs-muted)" }}>Изменено {new Date(item.record.updated_at).toLocaleString("ru-RU")}</p>}
        <div className="flex flex-wrap gap-2"><Link href={`/admin/pages/${item.slug}`} className="bs-button bs-button--primary bs-button--md flex-1"><Edit3 className="h-4 w-4" />Редактировать</Link><Link href={item.route} target="_blank" className="bs-button bs-button--outline bs-button--icon" aria-label={`Открыть ${item.title}`}><ArrowUpRight className="h-4 w-4" /></Link></div>
      </AdminCard>)}</div>
    </section>

    <section><div className="mb-4 flex items-center gap-2"><Settings2 className="h-5 w-5" style={{ color: "var(--bs-primary)" }} /><h2 className="text-lg font-semibold" style={{ color: "var(--bs-foreground)" }}>Контент из других разделов</h2></div>
      <div className="grid gap-3 md:grid-cols-2">{filtered.managed.map((item) => <AdminCard key={`${item.adminRoute}-${item.title}`} className="flex flex-wrap items-center gap-4 p-4"><div className="min-w-0 flex-1"><p className="font-medium" style={{ color: "var(--bs-foreground)" }}>{item.title}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--bs-muted)" }}>{item.description}</p></div><Link href={item.adminRoute} className="bs-button bs-button--outline bs-button--sm shrink-0">Управлять <ArrowUpRight className="h-3.5 w-3.5" /></Link></AdminCard>)}</div>
    </section>
  </div>;
}
