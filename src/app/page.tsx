"use client";

import Link from "next/link";
import { Brain, HandHelping, ArrowRight, Leaf, Sun, Flower2, Star, Quote, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import GlassCard from "@/components/ui/GlassCard";
import Reveal from "@/components/ui/Reveal";
import ReviewsCarousel from "@/components/ReviewsCarousel";

const methods = [
  { icon: Brain, title: "Социально-психологическая реабилитация", description: "Восстановление эмоционального ресурса и психологического благополучия.", href: "/rehabilitation", accent: "#c4b5fd" },
  { icon: HandHelping, title: "Физическая реабилитация", description: "Мягкое восстановление подвижности, работа с фасциальной системой и мышечными зажимами.", href: "/rehabilitation", accent: "#0F766E" },
];

const benefits = [
  { icon: Leaf, title: "Бережный подход", text: "Восстановление без насилия над телом, в комфортном для вас темпе." },
  { icon: Sun, title: "Индивидуальная программа", text: "Методы подбираются исходя из вашего состояния и запроса." },
  { icon: Flower2, title: "Целостный метод", text: "Тело и психика рассматриваются как единая система." },
];

const process = [
  { step: "01", title: "Знакомство", text: "Обсуждаем ваш запрос, историю и текущее состояние." },
  { step: "02", title: "Консультация", text: "Определяем подходящие методы реабилитации." },
  { step: "03", title: "Практика", text: "Реабилитационная работа по индивидуальной программе." },
  { step: "04", title: "Поддержка", text: "Сопровождение и рекомендации между сессиями." },
];

export default function HomePage() {
  return (
    <main>
      <Navbar />

      {/* HERO */}
      <section className="hero-surface relative min-h-[720px] overflow-hidden flex items-center lg:min-h-screen">
        <div className="orb orb-teal" style={{ top: "-10%", left: "50%", transform: "translateX(-50%)" }} />
        <div className="orb orb-rose" style={{ bottom: "10%", right: "-5%" }} />
        <div className="orb orb-amber" style={{ top: "30%", left: "-5%" }} />

        <Container className="relative grid lg:grid-cols-2 gap-12 lg:gap-16 items-center pt-28 pb-16 lg:pt-32 lg:pb-20">
          <Reveal>
            <div className="hero-eyebrow inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6 lg:mb-8 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--primary)' }}>
              <Sparkles className="w-4 h-4" />
              Реабилитолог • Хотьково
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] leading-[1] mb-6 lg:mb-8 max-w-[14ch]" style={{ color: 'var(--foreground)' }}>
              Через тело
              <span className="hero-title-accent block" style={{ color: 'var(--primary)' }}>к состоянию</span>
            </h1>

            <p className="hero-description text-base md:text-lg lg:text-xl leading-relaxed max-w-xl mb-8 lg:mb-10" style={{ color: 'var(--foreground-secondary)' }}>
              Социально-психологическая и физическая реабилитация. Помогаю восстановить ресурс организма через бережные методы работы с нервной системой и телом.
            </p>

            <div className="flex flex-wrap items-center gap-5 lg:gap-6 mb-10 lg:mb-12">
              <Link href="/contact" className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-8 lg:px-10 py-4 lg:py-5 text-sm lg:text-base font-medium gap-2.5">
                <span className="relative z-10">Записаться</span>
                <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/rehabilitation" className="glass inline-flex items-center justify-center rounded-full px-8 lg:px-10 py-4 lg:py-5 text-sm lg:text-base font-medium hover:-translate-y-0.5 transition-all duration-500" style={{ color: 'var(--foreground)', borderColor: 'var(--glass-border)' }}>
                О реабилитации
              </Link>
            </div>

            <div className="hero-stats flex gap-6 lg:gap-8 text-xs lg:text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              <div><div className="text-xl lg:text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>10+</div>лет практики</div>
              <div className="w-px" style={{ backgroundColor: 'var(--border)' }} />
              <div><div className="text-xl lg:text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>2</div>направления</div>
              <div className="w-px" style={{ backgroundColor: 'var(--border)' }} />
              <div><div className="text-xl lg:text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>100%</div>бережный подход</div>
            </div>
          </Reveal>

          <div className="hero-visual relative h-[500px] lg:h-[700px] hidden lg:block" aria-hidden="true">
            
            <div className="hero-visual-grid absolute inset-0 opacity-[0.03]">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="heroGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                    </pattern>
                    <pattern id="heroDots" width="40" height="40" patternUnits="userSpaceOnUse">
                      <circle cx="20" cy="20" r="1" fill="currentColor"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#heroGrid)" />
                  <rect width="100%" height="100%" fill="url(#heroDots)" />
                </svg>
              </div>
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />
            <Reveal delay={0.18}>
              <div className="hero-core absolute left-1/2 top-1/2 grid h-[270px] w-[270px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full">
                <div className="hero-core-inner grid h-[190px] w-[190px] place-items-center rounded-full text-center">
                  <div>
                    <div className="relative mx-auto mb-6 w-[180px] h-[180px]">
                      <div className="absolute inset-0 rounded-full blur-3xl opacity-40" style={{ background: 'var(--primary)' }} />
                      <img src="/logo.png" alt="Логотип" className="relative w-full h-full object-contain rounded-full mix-blend-lighten" />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="hero-float-card hero-float-card-top glass-feature absolute left-0 top-12 w-[220px] rounded-[26px] p-5">
                <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-secondary)' }}><span>01 / 03</span><span className="h-2 w-2 rounded-full" style={{ background: 'var(--primary)' }} /></div>
                <div className="text-lg font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>Состояние начинается с внимания к себе</div>
              </div>
            </Reveal>
            <Reveal delay={0.4}>
              <div className="hero-float-card hero-float-card-right glass-feature absolute right-0 top-[42%] w-[210px] rounded-[26px] p-5">
                <div className="mb-3 text-xs" style={{ color: 'var(--foreground-secondary)' }}>Индивидуальный маршрут</div>
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}><Leaf className="h-4 w-4" style={{ color: 'var(--primary)' }} /> Тело · психика · ресурс</div>
              </div>
            </Reveal>
            <Reveal delay={0.52}>
              <div className="hero-float-card hero-float-card-bottom glass-feature absolute bottom-10 left-[17%] w-[250px] rounded-[26px] p-5">
                <div className="mb-2 text-xs" style={{ color: 'var(--foreground-secondary)' }}>Результат работы</div>
                <div className="flex items-end justify-between"><span className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>100%</span><span className="pb-1 text-xs" style={{ color: 'var(--primary)' }}>бережный темп</span></div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <div className="premium-marquee relative overflow-hidden border-y" style={{ borderColor: 'var(--border)', color: 'var(--foreground-secondary)' }} aria-label="Принципы работы">
        <div className="premium-marquee-track flex min-w-max items-center gap-8 py-4 text-[10px] font-semibold uppercase tracking-[0.24em]">
          <span>бережность</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>внимание к телу</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>индивидуальный маршрут</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>возвращение к себе</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>бережность</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>внимание к телу</span><span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
          <span>индивидуальный маршрут</span>
        </div>
      </div>

      {/* МЕТОДЫ */}
      <div className="relative -mt-12 lg:-mt-16">
        <div className="absolute inset-0 section-gradient pointer-events-none" />
        <Container className="section-spacing relative">
          <SectionHeading eyebrow="Методы реабилитации" title="Два направления восстановления" subtitle="Индивидуальный подход: от психологической поддержки до физической реабилитации." />
          <div className="section-grid grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
            {methods.map((m, i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.title} delay={i * 0.1}>
                  <GlassCard href={m.href}>
                    <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: m.accent }}>
                      <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                    </div>
                    <h3 className="text-lg lg:text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{m.title}</h3>
                    <p className="text-sm lg:text-base leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>{m.description}</p>
                    <div className="mt-5 flex items-center gap-1 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: 'var(--primary)' }}>
                      Подробнее <ArrowRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    </div>
                  </GlassCard>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </div>

      {/* PHILOSOPHY */}
      <section className="relative py-32 lg:py-40 overflow-hidden">
        <Container className="relative text-center max-w-3xl mx-auto">
          <Reveal>
            <Quote className="w-8 h-8 lg:w-10 lg:h-10 mx-auto mb-6 lg:mb-8" style={{ color: 'var(--primary)', opacity: 0.25 }} />
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.15] mb-6" style={{ color: 'var(--foreground)' }}>
              Реабилитация — это не борьба. Это возвращение к себе через бережное восстановление нервной системы и тела.
            </blockquote>
            <p className="text-sm lg:text-base" style={{ color: 'var(--foreground-secondary)' }}>Каждый метод подобран с учётом вашего состояния и готовности к изменениям.</p>
          </Reveal>
        </Container>
      </section>

      {/* PROCESS */}
      <div className="relative -mt-12 lg:-mt-16">
        <Container className="section-spacing">
          <SectionHeading eyebrow="Как проходит реабилитация" title="Процесс работы" subtitle="Четыре шага к восстановлению." />
          <div className="section-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {process.map((p, i) => (
              <Reveal key={p.step} delay={i * 0.08}>
                <GlassCard>
                  <div className="text-4xl lg:text-5xl font-bold mb-3 lg:mb-4" style={{ color: 'var(--primary)', opacity: 0.12 }}>{p.step}</div>
                  <h3 className="text-base lg:text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>{p.text}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>

      {/* BENEFITS */}
      <div className="relative">
        <Container className="section-spacing relative">
          <SectionHeading eyebrow="Почему это работает" title="Принципы реабилитации" />
          <div className="section-grid grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <Reveal key={b.title} delay={i * 0.1}>
                  <GlassCard>
                    <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--primary-muted)' }}>
                      <Icon className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: 'var(--primary)' }} />
                    </div>
                    <h3 className="text-base lg:text-lg font-semibold text-center mb-2" style={{ color: 'var(--foreground)' }}>{b.title}</h3>
                    <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--foreground-secondary)' }}>{b.text}</p>
                  </GlassCard>
                </Reveal>
              );
            })}
          </div>

          <Reveal>
            <div className="text-center">
              <p className="mb-4" style={{ color: 'var(--foreground-secondary)' }}>Программа реабилитации подбирается индивидуально, исходя из вашего состояния и запроса.</p>
              <Link href="/contact" className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-6 lg:px-8 py-3 lg:py-3.5 font-medium gap-2 text-sm lg:text-base">
                <span className="relative z-10">Записаться на консультацию</span>
                <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </div>

      {/* ОТЗЫВЫ — ЖИВЫЕ ИЗ БАЗЫ */}
      <div className="relative -mt-12 lg:-mt-16">
        <Container className="section-spacing">
          <SectionHeading eyebrow="Отзывы" title="Что говорят клиенты" />
          <Reveal>
            <ReviewsCarousel />
          </Reveal>
          <div className="text-center mt-8">
            <Link
              href="/reviews"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              Все отзывы <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Container>
      </div>

      {/* CTA */}
      <Container className="section-spacing">
        <div className="relative overflow-hidden rounded-[40px] lg:rounded-[48px] px-6 lg:px-16 py-16 lg:py-20 text-center text-white" style={{ backgroundColor: 'var(--primary)' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_60%)]" />
          <div className="orb" style={{ background: 'rgba(255,255,255,0.1)', width: 400, height: 400, top: "-10%", left: "50%", transform: "translateX(-50%)", filter: "blur(100px)" }} />
          <div className="relative max-w-3xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight mb-4 lg:mb-6 leading-tight">Готовы начать восстановление?</h2>
            <p className="text-sm lg:text-lg text-white/80 leading-relaxed mb-8 lg:mb-10">Первая консультация поможет определить направление реабилитации и составить индивидуальную программу.</p>
            <Link href="/contact" className="inline-flex items-center justify-center rounded-full bg-white px-6 lg:px-8 py-3.5 lg:py-4 font-medium shadow-xl hover:opacity-90 transition-all hover:-translate-y-0.5 gap-2 text-sm lg:text-base" style={{ color: 'var(--primary)' }}>
              Записаться на консультацию <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
