import SiteImage from '@/components/SiteImage';
import type { Metadata } from "next";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import Navbar from "@/components/Navbar";
import { db } from "@/lib/db";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "О специалисте",
  description: "Информация о специалисте",
};

export default async function AboutPage() {
  const [{ data }, { data: documents }] = await Promise.all([
    db.from("page_content").select("*").eq("slug", "about").single(),
    db.from("about_documents").select("*").order("sort_order").order("created_at"),
  ]);

  return (
    <main className="page-shell">
      <Navbar />
      <section className="page-hero">
        <div className="max-w-3xl mx-auto">
          <div className="page-kicker rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] mb-7" style={{ color: 'var(--primary)' }}>
            <Sparkles className="w-4 h-4" /> О специалисте
          </div>
          <h1 className="page-title text-5xl md:text-6xl font-semibold leading-[1.02] mb-7" style={{ color: 'var(--foreground)' }}>
            {data?.title || "О специалисте"}
          </h1>
          <div
            className="prose prose-lg max-w-none leading-relaxed"
            style={{ color: 'var(--foreground-secondary)' }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(data?.content) }}
          />
          {documents && documents.length > 0 && <section className="mt-16"><div className="mb-7"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>Квалификация</p><h2 className="text-3xl font-semibold" style={{ color: "var(--foreground)" }}>Дипломы и сертификаты</h2></div><div className="grid gap-5 sm:grid-cols-2">{documents.map((document) => <figure key={String(document.id)} className="glass-feature overflow-hidden rounded-[24px]"><a href={String(document.image_url)} target="_blank" rel="noreferrer" className="block"><SiteImage src={String(document.image_url)} alt={String(document.title)} className="aspect-[4/3] w-full bg-white/70 object-contain p-3" /></a><figcaption className="p-4 text-sm font-medium" style={{ color: "var(--foreground)" }}>{String(document.title)}</figcaption></figure>)}</div></section>}
        </div>
      </section>
    </main>
  );
}
