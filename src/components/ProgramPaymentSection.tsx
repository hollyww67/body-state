"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Mail, Phone, ShieldCheck, BadgeCheck, Sparkles, CreditCard } from "lucide-react";
import PaymentButton from "@/components/PaymentButton";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
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
    <div className="rounded-3xl p-8 backdrop-blur-xl" style={{
      background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
        Оплатить программу онлайн
      </h2>

      <div className="flex items-baseline justify-between mb-6">
        <span style={{ color: 'var(--foreground-secondary)' }}>Стоимость</span>
        <span className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
          {price.toLocaleString()} ₽
        </span>
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Mail className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            placeholder="Email для чека"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 w-full rounded-2xl pl-12 pr-5 text-sm placeholder-gray-400 outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--foreground)",
            }}
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="tel"
            placeholder="Телефон (необязательно)"
            value={phone}
            onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
            className="h-14 w-full rounded-2xl pl-12 pr-5 text-sm placeholder-gray-400 outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>
      <div className="mb-5"><PersonalDataConsent id="program-payment-consent" checked={consent} onChange={setConsent} /></div>

      <PaymentButton
        amount={price}
        orderId={orderId}
        description={title}
        email={email}
        phone={phone}
        items={[{ name: title, price: price, quantity: 1, serviceCode: "recovery-program" }]}
        label={`Оплатить ${price.toLocaleString()} ₽ →`}
        className="h-16 w-full rounded-2xl text-lg font-bold text-white shadow-lg transition-all bg-gradient-to-r from-[var(--primary)] to-indigo-500 hover:from-[var(--primary-dark)] hover:to-indigo-600"
        consent={consent}
        disabled={!consent || (!email.trim() && !phone.trim())}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          Безопасная оплата
        </div>
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          Электронный чек
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          Мгновенная доставка
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          Возврат средств
        </div>
      </div>
    </div>
  );
}
