import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { getPageCopy } from "@/lib/page-copy";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Контакты реабилитолога Алёны Танчук в Хотьково",
};
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const copy = await getPageCopy("contact");
  const phoneHref = `tel:${copy.phone.replace(/[^+\d]/g, "")}`;
  return (
    <main className="page-shell">
      <Navbar />
      <section className="page-hero">
        <div className="max-w-3xl mx-auto">
          <div className="page-kicker mb-7 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{copy.eyebrow}</div>
          <h1 className="page-title text-5xl md:text-6xl font-semibold leading-[1.02] mb-4" style={{ color: 'var(--foreground)' }}>
            {copy.title}
          </h1>
          <p className="text-lg mb-12" style={{ color: 'var(--foreground-secondary)' }}>
            {copy.lead}
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-feature rounded-3xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-muted)' }}>
                <Phone className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{copy.phoneLabel}</p>
                <a href={phoneHref} className="text-sm hover:underline" style={{ color: 'var(--foreground-secondary)' }}>{copy.phone}</a>
              </div>
            </div>

            <div className="glass-feature rounded-3xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-muted)' }}>
                <Mail className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{copy.emailLabel}</p>
                <a href={`mailto:${copy.email}`} className="text-sm hover:underline" style={{ color: 'var(--foreground-secondary)' }}>{copy.email}</a>
              </div>
            </div>

            <div className="glass-feature rounded-3xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-muted)' }}>
                <MapPin className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{copy.addressLabel}</p>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{copy.address}</p>
              </div>
            </div>

            <div className="glass-feature rounded-3xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-muted)' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{copy.hoursLabel}</p>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{copy.hours}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <a
              href="/consultation"
              className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-8 py-4 font-medium gap-2"
            >
              {copy.button}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
