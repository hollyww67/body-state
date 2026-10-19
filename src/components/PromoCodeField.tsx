"use client";

import { useState } from "react";
import { Check, Loader2, Tag, X } from "lucide-react";

export type AppliedPromo = { code: string; subtotal: number; discount: number; total: number };

export default function PromoCodeField({ serviceCode, programId, onChange }: {
  serviceCode: "bfm" | "psychology" | "psychology_program";
  programId?: number;
  onChange: (promo: AppliedPromo | null) => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<AppliedPromo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, serviceCode, programId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Промокод не применён");
      const next = { code: String(data.code), subtotal: Number(data.subtotal), discount: Number(data.discount), total: Number(data.total) };
      setCode(next.code);
      setApplied(next);
      onChange(next);
    } catch (cause) {
      setApplied(null);
      onChange(null);
      setError(cause instanceof Error ? cause.message : "Промокод не применён");
    } finally { setLoading(false); }
  };

  const clear = () => {
    setCode("");
    setApplied(null);
    setError("");
    onChange(null);
  };

  return <div className="qp-promo rounded-2xl border p-3" style={{ borderColor: applied ? "var(--primary)" : "var(--input-border)", background: applied ? "var(--primary-muted)" : "var(--input-bg)" }}>
    <div className="flex items-center gap-2">
      <Tag className="h-4 w-4 flex-none" style={{ color: "var(--primary)" }} />
      <input aria-label="Промокод" value={code} disabled={Boolean(applied)} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void apply(); } }} placeholder="Есть промокод?" className="min-w-0 flex-1 bg-transparent text-sm font-medium uppercase tracking-wide outline-none disabled:opacity-80" style={{ color: "var(--foreground)" }} />
      {applied ? <button type="button" onClick={clear} className="grid h-8 w-8 place-items-center rounded-xl" aria-label="Убрать промокод"><X className="h-4 w-4" /></button> : <button type="button" onClick={() => void apply()} disabled={loading || code.length < 4} className="qp-promo-apply inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "var(--qp-promo-fill, var(--primary))", color: "var(--qp-promo-text, #fff)" }}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Применить</button>}
    </div>
    {applied && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--primary)" }}><Check className="h-3.5 w-3.5" />Скидка {applied.discount.toLocaleString("ru-RU")} ₽ применена</p>}
    {error && <p role="alert" className="mt-2 text-xs font-medium text-[var(--qp-danger)]">{error}</p>}
  </div>;
}
