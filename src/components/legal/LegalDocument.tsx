"use client";

import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { usePageCopy } from "@/lib/hooks/use-page-copy";

export default function LegalDocument({ slug, title, subtitle, children }: { slug?: string; title: string; subtitle?: string; children: ReactNode }) {
  const copy = usePageCopy(slug || "");
  const displayedTitle = copy.title || title;
  const displayedSubtitle = copy.subtitle || subtitle;
  const replacementParagraphs = (copy.body || "").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />
      <section className="px-4 pb-20 pt-32">
        <article className="mx-auto max-w-4xl rounded-[32px] border p-6 md:p-10" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--primary)" }}>Правовая информация</p>
          <h1 className="text-3xl font-semibold md:text-4xl" style={{ color: "var(--foreground)" }}>{displayedTitle}</h1>
          {displayedSubtitle && <p className="mt-4 leading-7" style={{ color: "var(--foreground-secondary)" }}>{displayedSubtitle}</p>}
          <div className="legal-copy mt-10 space-y-6 whitespace-pre-line text-sm leading-7" style={{ color: "var(--foreground-secondary)" }}>{replacementParagraphs.length ? replacementParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : children}</div>
        </article>
      </section>
    </main>
  );
}
