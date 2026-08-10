import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BfmBookingForm from "@/components/BfmBookingForm";
import { Brain, HandHelping, AudioLines, ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Реабилитация",
  description: "Социально-психологическая и физическая реабилитация в Хотьково. Индивидуальные программы восстановления.",
};

const methods = [
  {
    icon: Brain,
    title: "Социально-психологическая реабилитация",
    okved: "ОКВЭД 88.10.14",
    description:
      "Восстановление эмоционального ресурса и психологического благополучия. Помощь в преодолении тревожности, стресса, эмоционального выгорания. Поддержка в сложных жизненных ситуациях.",
    details: ["Восстановление эмоционального баланса", "Работа с тревожностью и стрессом", "Преодоление эмоционального выгорания", "Психологическая поддержка"],
    duration: "60 минут",
  },
  {
    icon: HandHelping,
    title: "Физическая реабилитация",
    okved: "ОКВЭД 88.10.17",
    description:
      "Консультация по социальной адаптации через восстановление тела методом БФМ.",
    details: ["Снятие мышечных зажимов и напряжения", "Восстановление подвижности суставов", "Улучшение эластичности фасций", "Нормализация работы вегетативной нервной системы"],
    duration: "45 минут",
  },
  {
    icon: AudioLines,
    title: "Биорезонансная коррекция -- Услуга не оказывается.",
    okved: "ОКВЭД 88.10.14",
    description:
      "Оздоровительная программа, направленная на нормализацию состояния организма через биорезонансный подход. Способствует восстановлению внутренних ресурсов и улучшению общего самочувствия.",
    details: ["Нормализация общего состояния организма", "Восстановление внутренних ресурсов", "Улучшение самочувствия", "Поддержка процессов саморегуляции"],
    duration: "60 минут",
  },
];

export default function RehabilitationPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
            <Sparkles className="w-4 h-4" />
            Реабилитация
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-6" style={{ color: 'var(--foreground)' }}>
            Восстановление ресурса организма
          </h1>
          <p className="text-lg leading-relaxed mb-4" style={{ color: 'var(--foreground-secondary)' }}>
            Реабилитация — это комплекс мер, направленных на восстановление психологического и физического благополучия. Я использую бережные методы, которые помогают организму восстановиться естественным путём, без насилия и принуждения.
          </p>
          <p className="text-lg leading-relaxed mb-12" style={{ color: 'var(--foreground-secondary)' }}>
            Начинаем с психологической поддержки — это основа. Затем подключаем физическую реабилитацию. Программа подбирается индивидуально после консультации.
          </p>

          {/* Методы */}
          <div className="space-y-8 mb-16">
            {methods.map((method, i) => {
              const Icon = method.icon;
              return (
                <div key={method.title} className="glass-feature rounded-3xl p-7">
                  <div className="flex items-start gap-5 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary-muted)' }}>
                      <Icon className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{method.title}</h2>
                      <p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>{method.okved} • {method.duration}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--foreground-secondary)' }}>{method.description}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {method.details.map((detail, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}></span>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Форма записи */}
          <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>Записаться на консультацию</h2>
          <div className="glass-feature rounded-3xl p-7 mb-12">
            <BfmBookingForm />
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>Не знаете, с чего начать? Запишитесь на консультацию — мы обсудим ваш запрос и подберём направление.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
