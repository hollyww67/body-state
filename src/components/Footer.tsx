import Link from "next/link";
import Image from "next/image";
import SocialLinks from "./SocialLinks";
import ShopVisibilityLink from "./ShopVisibilityLink";
import { ArrowUpRight, CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import { legalDetails as d } from "@/lib/legal";

export default function Footer() {
  return (
    <footer className="site-footer-premium px-4 pb-8 pt-16 lg:pt-20" style={{ color: 'var(--foreground-secondary)' }}>
      <div className="container-custom">
        <div className="footer-panel overflow-hidden rounded-[32px] border p-6 md:p-10 lg:rounded-[40px]" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="grid gap-10 lg:grid-cols-[1.35fr_0.8fr_1fr] lg:gap-14">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="brand-mark grid h-12 w-12 place-items-center overflow-hidden rounded-2xl">
                  <Image src="/logo.png" alt="" width={48} height={48} unoptimized className="rounded-2xl" />
                </span>
                <div>
                  <span className="block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Через тело к состоянию</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary)' }}>бережная реабилитация</span>
                </div>
              </div>
              <p className="max-w-md text-sm leading-7">Помогаю восстановить ресурс организма через внимательную работу с нервной системой, телом и состоянием.</p>
              <Link href="/rehabilitation#booking" className="liquid-btn mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white">
                <CalendarDays className="relative z-10 h-4 w-4" /><span className="relative z-10">Записаться</span><ArrowUpRight className="relative z-10 h-4 w-4" />
              </Link>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Навигация</p>
              <div className="grid gap-3 text-sm">
                <Link href="/about-rehabilitation" className="footer-link">О реабилитации</Link>
                <Link href="/bfm#booking" className="footer-link">Физическая реабилитация</Link>
                <Link href="/psychology" className="footer-link">Психологическая реабилитация</Link>
                <ShopVisibilityLink />
                <Link href="/account" className="footer-link">Личный кабинет</Link>
                <Link href="/reviews" className="footer-link">Отзывы</Link>
                <Link href="/promotions" className="footer-link">Акции</Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Контакты</p>
              <div className="grid gap-4 text-sm">
                <a href="tel:+79264269146" className="footer-contact"><Phone className="h-4 w-4" />+7 (926) 426-91-46</a>
                <a href="mailto:at@body-state.ru" className="footer-contact"><Mail className="h-4 w-4" />at@body-state.ru</a>
                <span className="footer-contact"><MapPin className="h-4 w-4" />Хотьково, Московская область</span>
              </div>
              <div className="mt-6"><SocialLinks /></div>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-4 border-t pt-6 text-xs md:flex-row md:items-end md:justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-1">
              <p>{d.operator} · ИНН {d.inn}{d.ogrnip ? ` · ОГРНИП ${d.ogrnip}` : ""}</p>
              <p>ОКВЭД 88.10.14 · ОКВЭД 88.10.17</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/oferta" className="footer-link">Оферта</Link>
              <Link href="/privacy" className="footer-link">Персональные данные</Link>
              <Link href="/personal-data-consent" className="footer-link">Согласие</Link>
              <Link href="/review-rules" className="footer-link">Правила отзывов</Link>
              <span>© {new Date().getFullYear()} Через тело к состоянию</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
