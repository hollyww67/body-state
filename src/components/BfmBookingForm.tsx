"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BookingCalendar from "./BookingCalendar";
import { trackMetricaGoal } from "./AnalyticsConsent";

export default function BfmBookingForm() {
  const [step, setStep] = useState<"calendar" | "form">("calendar");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tg, setTg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/book/bfm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: selectedSlot, client_name: name, client_phone: phone, client_email: email || undefined, client_tg: tg || undefined }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || "Ошибка при записи"); setSubmitting(false); return; }
    trackMetricaGoal("booking_bfm_success");
    setDone(true);
  };

  return (
    <AnimatePresence mode="wait">
      {done ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl p-8 text-center" style={{ background: 'var(--primary-muted)', borderColor: 'var(--primary-light)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--primary)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="font-semibold text-xl" style={{ color: 'var(--primary)' }}>Заявка отправлена!</p>
          <p style={{ color: 'var(--primary)' }} className="mt-2">Специалист подтвердит запись, и вам придёт уведомление.</p>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {step === "calendar" && <BookingCalendar serviceType="bfm" onSelect={handleSlotSelect} />}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <button type="button" onClick={() => setStep("calendar")} className="text-sm font-medium transition-colors" style={{ color: 'var(--foreground-secondary)' }}>← Назад к выбору времени</button>
              <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>Ваши данные</h4>
              <input required type="text" placeholder="Имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2 transition-all" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              <input required type="tel" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2 transition-all" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              <input type="email" placeholder="Email (необязательно)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2 transition-all" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              <input type="text" placeholder="Telegram @username (необязательно)" value={tg} onChange={(e) => setTg(e.target.value)} className="w-full h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2 transition-all" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              {error && <p className="text-red-500 font-medium text-sm">{error}</p>}
              <button type="submit" disabled={submitting} className="liquid-btn group relative w-full inline-flex items-center justify-center rounded-full text-white px-6 py-3 font-medium gap-2 disabled:opacity-50">
                <span className="relative z-10">{submitting ? "Отправляем..." : "Записаться"}</span>
              </button>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
