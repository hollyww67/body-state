import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import SocialLinks from "./SocialLinks";
import ShopVisibilityLink from "./ShopVisibilityLink";
import BodyStateWordmark from "./BodyStateWordmark";
import { legalDetails as d } from "@/lib/legal";
import "./quiet-nav.css";

export default function Footer() {
  return (
    <footer className="quiet-footer">
      <div className="qf-container">
        <div className="qf-grid">
          <div>
            <Link href="/" className="qf-brand" aria-label="Body State — главная"><BodyStateWordmark /></Link>
            <p className="qf-intro">Через тело к состоянию.<br />Индивидуальная социально-психологическая и физическая реабилитация в Хотьково.</p>
            <Link href="/rehabilitation#booking" className="qf-booking">Записаться на приём<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <div>
            <p className="qf-heading" id="qf-navigation-title">Навигация</p>
            <nav className="qf-links" aria-labelledby="qf-navigation-title">
              <Link href="/bfm#booking">Физическая реабилитация</Link>
              <Link href="/psychology">Психологическая реабилитация</Link>
              <Link href="/about-rehabilitation">О реабилитации</Link>
              <Link href="/about">О специалисте</Link>
              <Link href="/program">Программа</Link>
              <Link href="/reviews">Отзывы</Link>
              <Link href="/promotions">Акции</Link>
              <Link href="/blog">Блог</Link>
              <ShopVisibilityLink />
              <Link href="/account">Личный кабинет</Link>
            </nav>
          </div>
          <div>
            <p className="qf-heading">Будем на связи</p>
            <address className="qf-contacts">
              <a href="tel:+79264269146" className="qf-contact"><Phone size={16} aria-hidden="true" />{d.phone}</a>
              <a href={`mailto:${d.email}`} className="qf-contact"><Mail size={16} aria-hidden="true" />{d.email}</a>
              <span className="qf-contact"><MapPin size={16} aria-hidden="true" />Хотьково, Московская область</span>
            </address>
            <div className="qf-links"><Link href="/contact">Контакты и как добраться<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
            <div className="qf-socials"><SocialLinks /></div>
          </div>
        </div>
        <div className="qf-bottom">
          <div><p>{d.operator} · ИНН {d.inn}{d.ogrnip ? ` · ОГРНИП ${d.ogrnip}` : ""}</p><p>ОКВЭД 88.10.14 · ОКВЭД 88.10.17</p><p className="qf-copyright">© {new Date().getFullYear()} Body State · Через тело к состоянию</p></div>
          <nav className="qf-legal" aria-label="Правовая информация">
            <Link href="/oferta">Оферта</Link>
            <Link href="/privacy">Персональные данные</Link>
            <Link href="/personal-data-consent">Согласие на обработку данных</Link>
            <Link href="/review-rules">Правила отзывов</Link>
            <Link href="/consent-publication">Согласие на публикацию отзыва</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
