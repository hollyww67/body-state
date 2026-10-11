"use client";

import Link from "next/link";
import { ArrowRight, Gift, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type Promotion = {
  id: string;
  title: string;
  summary: string;
  details: string;
  badge: string;
  cta_label: string;
  cta_url: string;
};

const dismissedKey = "body-state-promotions-dismissed";

export default function PromotionsPopup() {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [open, setOpen] = useState(false);

  const dismiss = () => {
    setOpen(false);
    try { sessionStorage.setItem(dismissedKey, "1"); } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(dismissedKey)) return;
    } catch {}

    void fetch("/api/promotions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Promotions unavailable");
        return response.json() as Promise<{ promotions?: Promotion[] }>;
      })
      .then((data) => {
        const currentPromotion = data.promotions?.[0];
        if (!cancelled && currentPromotion) {
          setPromotion(currentPromotion);
          window.setTimeout(() => { if (!cancelled) setOpen(true); }, 650);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [open]);

  if (!promotion || !open) return null;

  const description = promotion.summary || promotion.details;
  return (
    <aside className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-h-[55dvh] w-auto max-w-md overflow-y-auto rounded-[24px] sm:inset-x-auto sm:bottom-6 sm:left-6" aria-labelledby="promotion-popup-title">
      <section className="relative overflow-hidden rounded-[24px] border p-4 shadow-2xl sm:p-5" style={{ background: "color-mix(in srgb, var(--surface-elevated) 94%, transparent)", borderColor: "var(--glass-border)", backdropFilter: "blur(18px) saturate(150%)" }}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl" style={{ background: "var(--primary)", opacity: 0.2 }} />
        <button type="button" onClick={dismiss} className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full border transition-colors hover:bg-[var(--primary-muted)]" style={{ borderColor: "var(--glass-border)", color: "var(--foreground)" }} aria-label="Закрыть акцию"><X className="h-4 w-4" /></button>
        <div className="relative flex gap-3 pr-9">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary-muted)] text-[var(--primary)]"><Gift className="h-5 w-5" /></div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]"><Sparkles className="h-3 w-3" />{promotion.badge || "Акция"}</span>
            <h2 id="promotion-popup-title" className="mt-1 text-base font-semibold leading-5 sm:text-lg" style={{ color: "var(--foreground)" }}>{promotion.title}</h2>
            {description && <p className="mt-1.5 line-clamp-3 break-words text-xs leading-5 sm:text-sm" style={{ color: "var(--foreground-secondary)" }}>{description}</p>}
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 pl-14">
          <Link href={promotion.cta_url || "/rehabilitation#booking"} onClick={dismiss} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">{promotion.cta_label || "Записаться"}<ArrowRight className="h-3.5 w-3.5" /></Link>
          <Link href="/promotions" onClick={dismiss} className="text-sm font-semibold transition-colors hover:opacity-70" style={{ color: "var(--primary)" }}>Все акции</Link>
        </div>
      </section>
    </aside>
  );
}
