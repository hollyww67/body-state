import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Brain, Check, Compass, Footprints, HandHelping,
  HeartHandshake, ShieldCheck, Sparkles,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";
import { getPageCopy } from "@/lib/page-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "О реабилитации",
  description: "Как устроена психологическая и физическая реабилитация: направления, этапы работы и принципы бережного восстановления.",
};

const stepIcons = [Compass, HeartHandshake, Footprints, ShieldCheck];

export default async function AboutRehabilitationPage() {
  const copy = await getPageCopy("about-rehabilitation");
  const principles = copy.principles.split("\n").map((item) => item.trim()).filter(Boolean);

  return (
    <main className="page-shell">
      <Navbar />

      <section className="page-hero overflow-hidden">
        <Container className="page-hero-inner relative max-w-6xl">
          <div className="orb orb-teal -left-40 top-0 opacity-40" />
          <div className="orb orb-rose -right-40 top-32 opacity-30" />
          <div className="relative grid items-end gap-10 lg:grid-cols-[1.25fr_.75fr]">
            <div>
              <div className="page-kicker mb-7 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>
                <Sparkles className="h-4 w-4" />{copy.eyebrow}
              </div>
              <h1 className="page-title max-w-4xl text-5xl font-semibold leading-[1.02] md:text-6xl" style={{ color: "var(--foreground)" }}>{copy.title}</h1>
              <p className="page-lead mt-7 max-w-3xl text-lg leading-8" style={{ color: "var(--foreground-secondary)" }}>{copy.lead}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/rehabilitation#booking" className="liquid-btn group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white"><span className="relative z-10">Записаться</span><ArrowRight className="relative z-10 h-4 w-4" /></Link>
                <Link href="/psychology" className="glass inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold" style={{ color: "var(--foreground)", borderColor: "var(--glass-border)" }}>Посмотреть программы</Link>
              </div>
            </div>
            <div className="content-panel rounded-[30px] p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>В центре подхода</p>
              <p className="mt-4 text-2xl font-semibold leading-tight" style={{ color: "var(--foreground)" }}>Не отдельный симптом, а человек и его текущее состояние</p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs" style={{ color: "var(--foreground-secondary)" }}>
                {["Психика", "Тело", "Ресурс"].map((item) => <div key={item} className="rounded-2xl border px-2 py-4" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>{item}</div>)}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="px-4 pb-20 lg:pb-28">
        <div className="mx-auto max-w-6xl space-y-20 lg:space-y-28">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>Суть процесса</p><h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: "var(--foreground)" }}>{copy.definitionTitle}</h2></div>
            <div className="glass-feature rounded-[30px] p-6 md:p-9"><p className="text-lg leading-8" style={{ color: "var(--foreground-secondary)" }}>{copy.definitionText}</p></div>
          </div>

          <div>
            <div className="mb-8 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>Два направления</p><h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: "var(--foreground)" }}>Разные точки входа — единое внимание к человеку</h2></div>
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="glass-feature group rounded-[32px] p-6 md:p-8">
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-violet-600 text-white"><Brain className="h-6 w-6" /></div>
                <h3 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>{copy.psychologyTitle}</h3>
                <p className="mt-4 leading-7" style={{ color: "var(--foreground-secondary)" }}>{copy.psychologyText}</p>
                <Link href="/psychology" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--primary)" }}>Психологические программы <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
              </article>
              <article className="glass-feature group rounded-[32px] p-6 md:p-8">
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white"><HandHelping className="h-6 w-6" /></div>
                <h3 className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>{copy.physicalTitle}</h3>
                <p className="mt-4 leading-7" style={{ color: "var(--foreground-secondary)" }}>{copy.physicalText}</p>
                <Link href="/bfm#booking" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--primary)" }}>Записаться на физическую реабилитацию <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
              </article>
            </div>
          </div>

          <div>
            <div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>Последовательно и понятно</p><h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: "var(--foreground)" }}>{copy.processTitle}</h2></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((number) => {
                const Icon = stepIcons[number - 1];
                return <article key={number} className="content-panel rounded-[26px] p-5 md:p-6"><div className="mb-6 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}><Icon className="h-5 w-5" /></span><span className="text-xs font-semibold" style={{ color: "var(--foreground-secondary)" }}>0{number}</span></div><h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{copy[`step${number}Title`]}</h3><p className="mt-3 text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>{copy[`step${number}Text`]}</p></article>;
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div className="glass-feature rounded-[32px] p-6 md:p-9"><h2 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>{copy.principlesTitle}</h2><ul className="mt-7 grid gap-4">{principles.map((item) => <li key={item} className="flex gap-3 text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}><span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}><Check className="h-3.5 w-3.5" /></span>{item}</li>)}</ul></div>
            <aside className="rounded-[32px] border p-6 md:p-9" style={{ borderColor: "var(--glass-border)", background: "var(--input-bg)" }}><ShieldCheck className="h-8 w-8" style={{ color: "var(--primary)" }} /><h2 className="mt-6 text-xl font-semibold" style={{ color: "var(--foreground)" }}>Важно знать</h2><p className="mt-4 text-sm leading-7" style={{ color: "var(--foreground-secondary)" }}>{copy.notice}</p></aside>
          </div>

          <div className="relative overflow-hidden rounded-[36px] px-6 py-14 text-center text-white md:px-12 md:py-16" style={{ background: "var(--primary)" }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.16),transparent_58%)]" />
            <div className="relative mx-auto max-w-2xl"><h2 className="text-3xl font-semibold md:text-4xl">{copy.ctaTitle}</h2><p className="mt-4 leading-7 text-white/80">{copy.ctaText}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/rehabilitation#booking" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold" style={{ color: "var(--primary)" }}>Выбрать время <ArrowRight className="h-4 w-4" /></Link><Link href="/bfm#booking" className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white">Только физическая реабилитация</Link></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
