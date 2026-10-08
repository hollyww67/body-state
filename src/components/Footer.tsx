import Link from "next/link";
import Image from "next/image";
import SocialLinks from "./SocialLinks";
import { AnalyticsSettingsButton } from "./AnalyticsConsent";

export default function Footer() {
  return (
    <footer className="border-t px-4 py-8 lg:py-10" style={{ borderColor: 'var(--border)', color: 'var(--foreground-secondary)' }}>
      <div className="container-custom">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Через тело к состоянию" width={32} height={32} unoptimized className="rounded-lg" />
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Через тело к состоянию</span>
          </div>

          <SocialLinks />

          <div className="text-center space-y-1 text-xs lg:text-sm">
            <p>Танчук Алёна Васильевна, ИНН 343508662268</p>
            <p>ОКВЭД 88.10.14 — социально-психологическая реабилитация</p>
            <p>ОКВЭД 88.10.17 — физическая реабилитация</p>
            <p>
              <a href="tel:+79264269146" className="hover:underline" style={{ color: 'var(--primary)' }}>+7 (926) 426-91-46</a>
              {" | "}
              <a href="mailto:at@body-state.ru" className="hover:underline" style={{ color: 'var(--primary)' }}>at@body-state.ru</a>
            </p>
            <p className="space-x-4">
              <Link href="/oferta" className="hover:underline" style={{ color: 'var(--primary)' }}>Оферта</Link>
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--primary)' }}>Конфиденциальность</Link>
              <Link href="/reviews" className="hover:underline" style={{ color: 'var(--primary)' }}>Отзывы</Link>
              <Link href="/qr" className="hover:underline" style={{ color: 'var(--primary)' }}>QR-коды</Link>
              <AnalyticsSettingsButton />
            </p>
          </div>
          <p className="text-xs">© Через тело к состоянию. Хотьково.</p>
        </div>
      </div>
    </footer>
  );
}
