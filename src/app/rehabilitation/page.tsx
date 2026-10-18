import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { Brain, HandHelping, AudioLines } from "lucide-react";
import { getPageCopy } from "@/lib/page-copy";
import { getServicePrice } from "@/lib/service-prices";

export const metadata: Metadata = {
  title: "Реабилитация",
  description: "Социально-психологическая и физическая реабилитация в Хотьково. Индивидуальные программы восстановления.",
};
export const dynamic = "force-dynamic";

const methods = [
  {
    icon: Brain,
    title: "Психологическая реабилитация",
    okved: "ОКВЭД 88.10.14",
    description:
      "Восстановление эмоционального ресурса и психологического благополучия. Помощь в преодолении тревожности, стресса, эмоционального выгорания. Поддержка в сложных жизненных ситуациях.",
    details: ["Восстановление эмоционального баланса", "Работа с тревожностью и стрессом", "Преодоление эмоционального выгорания", "Психологическая поддержка"],
    duration: "90 минут",
  },
  {
    icon: HandHelping,
    title: "Физическая реабилитация",
    okved: "ОКВЭД 88.10.17",
    description:
      "Консультация по социальной адаптации через бережное восстановление тела.",
    details: ["Снятие мышечных зажимов и напряжения", "Восстановление подвижности суставов", "Улучшение эластичности фасций", "Нормализация работы вегетативной нервной системы"],
    duration: "90 минут",
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

export default async function RehabilitationPage() {
  const [copy, bfmPrice, psychologyPrice] = await Promise.all([
    getPageCopy("rehabilitation"),
    getServicePrice("bfm"),
    getServicePrice("psychology"),
  ]);
  return (
    <main className="page-shell qp-booking-page">
      <Navbar />
      <section className="qp-booking-intro">
        <h1 className="sr-only">{copy.bookingTitle}</h1>
      </section>
      <section className="px-4 pb-20 lg:pb-28">
        <div className="max-w-5xl mx-auto">
          {/* Форма записи показывается раньше описания направлений. */}
          <div id="booking" className="scroll-mt-28 mb-16">
            <div className="qp-booking-card">
              <ServiceBookingForm bfmPrice={bfmPrice.price} psychologyPrice={psychologyPrice.price} />
            </div>
            <p className="mt-4 text-center text-sm" style={{ color: "var(--foreground-secondary)" }}>Для очного приёма можно оплатить онлайн или на месте. Запись доступна для управления в личном кабинете.</p>
            <p className="mt-4 text-center text-sm" style={{ color: "var(--foreground-secondary)" }}>{copy.bookingHint}</p>
          </div>

          <div id="procedures" className="scroll-mt-28">
            <h2 className="mb-4 text-2xl font-semibold">{copy.title}</h2>
            <p className="mb-4 text-base leading-7 text-[var(--foreground-secondary)]">{copy.lead}</p>
            <p className="mb-8 text-base leading-7 text-[var(--foreground-secondary)]">{copy.leadSecond}</p>
            <div className="mb-7"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--primary)" }}>Подробнее</p><h2 className="text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: "var(--foreground)" }}>Описание направлений</h2></div>
            <div className="space-y-8">
              {methods.map((method, index) => {
              const Icon = method.icon;
              const itemNumber = index + 1;
              const itemTitle = copy[`service${itemNumber}Title`] || method.title;
              const itemDescription = copy[`service${itemNumber}Description`] || method.description;
              const itemDetails = (copy[`service${itemNumber}Details`] || method.details.join("\n")).split("\n").map((item) => item.trim()).filter(Boolean);
              return (
                <div key={method.title} className="service-card glass-feature rounded-[30px] p-6 md:p-8">
                  <div className="flex items-start gap-5 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--primary-muted)' }}>
                      <Icon className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{itemTitle}</h2>
                      <p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>{method.okved} • {method.duration}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--foreground-secondary)' }}>{itemDescription}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {itemDetails.map((detail, j) => (
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
          </div>
        </div>
      </section>
    </main>
  );
}
