"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Brain, CheckCircle2, Clock, HandHelping, ShieldCheck, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import { trackMetricaGoal } from "@/components/AnalyticsConsent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const directions = [
  { icon: Brain, label: "Социально-психологическая реабилитация", desc: "Восстановление эмоционального благополучия", available: true },
  { icon: HandHelping, label: "Физическая реабилитация", desc: "Восстановление подвижности и снятие напряжения", available: true },
  { icon: Sparkles, label: "Биорезонансная коррекция", desc: "Скоро в доступе", available: false },
];

const perks = [
  { icon: Clock, text: "Ответим в течение дня" },
  { icon: ShieldCheck, text: "Конфиденциально и бережно" },
  { icon: CheckCircle2, text: "Индивидуальный подход" },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [direction, setDirection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name.trim(),
          client_phone: phone.trim(),
          notes: [direction, telegram.trim() ? `Telegram: ${telegram.trim()}` : ""].filter(Boolean).join("\n"),
        }),
      });
      if (!response.ok) throw new Error("request_failed");
      trackMetricaGoal("contact_request_success");
      setDone(true);
    } catch {
      setError("Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />
      <section className="px-4 pb-20 pt-32 lg:pb-28 lg:pt-40">
        <div className="mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="success" initial={false} animate={{ opacity: 1, y: 0 }} className="glass-feature rounded-[32px] px-6 py-20 text-center lg:px-12">
                <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full" style={{ background: "var(--primary-muted)" }}>
                  <CheckCircle2 className="h-10 w-10" style={{ color: "var(--primary)" }} />
                </div>
                <h1 className="mb-4 text-3xl font-semibold lg:text-4xl" style={{ color: "var(--foreground)" }}>Заявка принята</h1>
                <p className="text-lg" style={{ color: "var(--foreground-secondary)" }}>Свяжемся с вами в ближайшее время.</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={false} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-10 text-center lg:mb-12">
                  <div className="glass mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm" style={{ color: "var(--primary)" }}><Sparkles className="h-4 w-4" /> Первый шаг</div>
                  <h1 className="mb-6 text-4xl font-semibold leading-none tracking-[-0.04em] md:text-5xl lg:text-6xl" style={{ color: "var(--foreground)" }}>Начните <span className="block" style={{ color: "var(--primary)" }}>с консультации</span></h1>
                  <p className="mx-auto max-w-xl text-lg leading-relaxed" style={{ color: "var(--foreground-secondary)" }}>Познакомимся, обсудим ваш запрос и подберём направление реабилитации.</p>
                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-2">
                  {directions.map((item) => {
                    const Icon = item.icon;
                    const selected = direction === item.label;
                    return (
                      <button key={item.label} type="button" disabled={!item.available} aria-pressed={selected} onClick={() => item.available && setDirection(selected ? "" : item.label)} className={`rounded-2xl border-2 p-4 text-left transition-all ${!item.available ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5"}`} style={{ borderColor: selected ? "var(--primary)" : "var(--input-border)", background: selected ? "var(--primary-muted)" : "var(--input-bg)" }}>
                        <Icon className="mb-2 h-5 w-5" style={{ color: selected ? "var(--primary)" : "var(--foreground-secondary)" }} />
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{item.label}</p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-secondary)" }}>{item.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <Card className="p-6 lg:p-8">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="sr-only" htmlFor="contact-name">Имя и фамилия</label>
                    <Input id="contact-name" required autoComplete="name" type="text" placeholder="Имя и фамилия" value={name} onChange={(event) => setName(event.target.value)} />
                    <label className="sr-only" htmlFor="contact-phone">Телефон</label>
                    <Input id="contact-phone" required autoComplete="tel" type="tel" placeholder="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />
                    <label className="sr-only" htmlFor="contact-telegram">Telegram</label>
                    <Input id="contact-telegram" autoComplete="off" type="text" placeholder="Telegram @username" value={telegram} onChange={(event) => setTelegram(event.target.value)} />
                    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" disabled={submitting} size="lg" className="group relative w-full">
                      <span className="relative z-10">{submitting ? "Отправляем…" : "Оставить заявку"}</span><ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </form>
                </Card>

                <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3">
                  {perks.map((perk) => { const Icon = perk.icon; return <div key={perk.text} className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-secondary)" }}><Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />{perk.text}</div>; })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
