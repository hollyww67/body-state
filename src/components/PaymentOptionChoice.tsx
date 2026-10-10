"use client";

import { Banknote, CreditCard } from "lucide-react";

export type PaymentOption = "online" | "at_appointment";

export default function PaymentOptionChoice({ value, onChange, onlineOnly = false }: {
  value: PaymentOption;
  onChange: (value: PaymentOption) => void;
  onlineOnly?: boolean;
}) {
  if (onlineOnly) return <div className="rounded-2xl border p-4" style={{ borderColor: "var(--input-border)", background: "var(--primary-muted)" }}><p className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4" style={{ color: "var(--primary)" }} />Онлайн-консультация оплачивается при записи</p></div>;
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">Когда оплатить?</legend><div className="grid gap-2 sm:grid-cols-2">
    {([{ id: "online", title: "Оплатить сейчас", note: "Картой онлайн", icon: CreditCard }, { id: "at_appointment", title: "На приёме", note: "Без оплаты сейчас", icon: Banknote }] as const).map((item) => { const Icon=item.icon; const active=value===item.id; return <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-pressed={active} className="rounded-2xl border p-3 text-left transition" style={{ borderColor: active ? "var(--primary)" : "var(--input-border)", background: active ? "var(--primary-muted)" : "var(--input-bg)" }}><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />{item.title}</span><span className="mt-1 block text-xs" style={{ color: "var(--foreground-secondary)" }}>{item.note}</span></button>; })}
  </div></fieldset>;
}
