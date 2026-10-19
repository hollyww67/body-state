"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import PaymentButton from "@/components/PaymentButton";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
import TextField from "@/components/ui/TextField";
import { formatRussianPhoneInput } from "@/lib/phone";
import { useAccountPrefill } from "@/lib/hooks/use-account-prefill";

interface ProgramPaymentSectionProps {
  title: string;
  price: number;
}

export default function ProgramPaymentSection({ title, price }: ProgramPaymentSectionProps) {
  const profile = useAccountPrefill();
  const reactId = useId();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const orderId = useMemo(() => `program-${reactId.replace(/:/g, "")}-${Date.now()}`, [reactId]);

  useEffect(() => {
    if (!profile) return;
    setEmail((value) => value || profile.email || "");
    setPhone((value) => value || (profile.phone ? formatRussianPhoneInput(profile.phone) : ""));
  }, [profile]);

  if (price <= 0) return null;

  return (
    <div className="rounded-2xl border p-6 sm:p-8" style={{
      background: "var(--qp-surface)",
      borderColor: "var(--qp-border)",
    }}>
      <h2 className="mb-6 text-2xl" style={{ color: "var(--qp-text)" }}>
        Оплатить программу онлайн
      </h2>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <span style={{ color: "var(--qp-text-secondary)" }}>Стоимость</span>
        <span className="text-3xl font-medium tabular-nums" style={{ color: "var(--qp-text)" }}>
          {price.toLocaleString("ru-RU")} ₽
        </span>
      </div>

      <div className="space-y-4 mb-6">
        <TextField
          id={`${reactId}-email`}
          label="Email для чека"
          type="email"
          autoComplete="email"
          placeholder="name@example.ru"
          icon={<Mail className="h-4 w-4" />}
          hint="Для оплаты укажите email или телефон."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id={`${reactId}-phone`}
          label="Телефон"
          type="tel"
          autoComplete="tel"
          optional
          placeholder="+7 (___) ___-__-__"
          icon={<Phone className="h-4 w-4" />}
          value={phone}
          onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
        />
      </div>
      <div className="mb-5"><PersonalDataConsent id="program-payment-consent" checked={consent} onChange={setConsent} /></div>

      <PaymentButton
        amount={price}
        orderId={orderId}
        description={title}
        email={email}
        phone={phone}
        items={[{ name: title, price: price, quantity: 1, serviceCode: "recovery-program" }]}
        label={`Оплатить ${price.toLocaleString("ru-RU")} ₽ →`}
        className="min-h-12 w-full rounded-2xl bg-[var(--qp-brand)] px-6 py-3 text-sm font-medium text-[var(--qp-on-brand)] transition-colors hover:bg-[var(--qp-brand-hover)] active:bg-[var(--qp-brand-pressed)] active:text-white focus-visible:outline-2 focus-visible:outline-[var(--qp-focus)] focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
        consent={consent}
        disabled={!consent || (!email.trim() && !phone.trim())}
      />

      <p className="mt-6 text-sm leading-6" style={{ color: "var(--qp-text-secondary)" }}>
        <Link href="/oferta" className="inline-flex min-h-11 items-center text-[var(--qp-link)] underline underline-offset-4 hover:text-[var(--qp-text)]">Условия оплаты и возврата</Link>
      </p>
    </div>
  );
}
