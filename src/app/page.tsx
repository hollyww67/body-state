"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import EditorialReviews from "@/components/EditorialReviews";
import { usePageCopy } from "@/lib/hooks/use-page-copy";
import "./home-editorial.css";

export default function HomePage() {
  const copy = usePageCopy("home");

  const services = [
    { number: "01", title: copy.method1Title, description: copy.method1Text, href: "/psychology" },
    { number: "02", title: copy.method2Title, description: copy.method2Text, href: "/bfm#booking" },
  ];

  const steps = [
    { number: "01", title: copy.process1Title, description: copy.process1Text },
    { number: "02", title: copy.process2Title, description: copy.process2Text },
    { number: "03", title: copy.process3Title, description: copy.process3Text },
    { number: "04", title: copy.process4Title, description: copy.process4Text },
  ];

  return (
    <main className="bs-editorial">
      <Navbar />

      <section className="bs-e-hero" aria-labelledby="bs-home-title">
        <div className="bs-e-container bs-e-hero-inner">
          <div className="bs-e-overline">
            <span className="bs-e-wordmark">BODY STATE</span>
            <span className="bs-e-location">{copy.heroEyebrow}</span>
          </div>

          <div className="bs-e-hero-grid">
            <div className="bs-e-hero-copy">
              <p className="bs-e-kicker">Внимание к себе начинается здесь</p>
              <h1 id="bs-home-title" className="bs-e-title">
                <span>{copy.heroTitle}</span>
                <em>{copy.heroAccent}</em>
              </h1>
              <p className="bs-e-lead">{copy.heroDescription}</p>
              <div className="bs-e-actions">
                <Link className="bs-e-button bs-e-button-dark" href="/rehabilitation#booking">
                  Записаться на консультацию
                  <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
                </Link>
                <Link className="bs-e-text-link" href="/about-rehabilitation">
                  Узнать о подходе
                  <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            <aside className="bs-e-hero-aside" aria-label="Философия Body State">
              <div className="bs-e-aside-top">
                <span>BODY</span>
                <span>STATE</span>
              </div>
              <div className="bs-e-aside-bottom">
                <p>Тело и состояние связаны. Работа начинается с того, чтобы услышать себя.</p>
                <span>Индивидуальная работа · Хотьково</span>
              </div>
            </aside>
          </div>

          <div className="bs-e-hero-foot">
            <span>Практика бережного восстановления</span>
            <span>Психика / Тело / Состояние</span>
          </div>
        </div>
      </section>

      <section className="bs-e-services bs-e-section" aria-labelledby="bs-services-title">
        <div className="bs-e-container">
          <div className="bs-e-section-head">
            <p className="bs-e-section-index">01 / Направления</p>
            <div>
              <h2 id="bs-services-title">{copy.methodsTitle}</h2>
              <p className="bs-e-section-description">{copy.methodsDescription}</p>
            </div>
          </div>

          <div className="bs-e-service-list">
            {services.map((service) => (
              <Link key={service.number} className="bs-e-service-row" href={service.href}>
                <span className="bs-e-service-number">{service.number}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ArrowUpRight className="bs-e-service-arrow" aria-hidden="true" size={28} strokeWidth={1.15} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bs-e-manifesto bs-e-section" aria-labelledby="bs-manifesto-title">
        <div className="bs-e-container bs-e-manifesto-grid">
          <p className="bs-e-section-index">02 / Философия</p>
          <div>
            <h2 id="bs-manifesto-title" className="sr-only">Наш подход</h2>
            <blockquote>{copy.philosophy}</blockquote>
            <p>{copy.philosophyNote}</p>
            <Link href="/about" className="bs-e-text-link">
              Подробнее о специалисте
              <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bs-e-process bs-e-section" aria-labelledby="bs-process-title">
        <div className="bs-e-container">
          <div className="bs-e-section-head">
            <p className="bs-e-section-index">03 / Как мы работаем</p>
            <div>
              <h2 id="bs-process-title">{copy.processTitle}</h2>
              <p className="bs-e-section-description">{copy.processDescription}</p>
            </div>
          </div>
          <ol className="bs-e-steps">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="bs-e-step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bs-e-reviews bs-e-section" aria-labelledby="bs-reviews-title">
        <div className="bs-e-container">
          <div className="bs-e-section-head">
            <p className="bs-e-section-index">04 / Отзывы</p>
            <div>
              <h2 id="bs-reviews-title">{copy.reviewsTitle}</h2>
              <p className="bs-e-section-description">Реальные истории людей, которые приходят на консультации и процедуры.</p>
            </div>
          </div>
          <div className="bs-e-reviews-content"><EditorialReviews /></div>
          <div className="bs-e-reviews-foot">
            <Link href="/reviews" className="bs-e-text-link">
              Читать все отзывы
              <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bs-e-appointment" aria-labelledby="bs-appointment-title">
        <div className="bs-e-container bs-e-appointment-inner">
          <p className="bs-e-section-index">Следующий шаг</p>
          <div>
            <h2 id="bs-appointment-title">{copy.ctaTitle}</h2>
            <p>{copy.ctaDescription}</p>
            <Link href="/rehabilitation#booking" className="bs-e-button bs-e-button-light">
              {copy.ctaButton}
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </Link>
          </div>
          <span className="bs-e-appointment-signature">BODY STATE</span>
        </div>
      </section>
    </main>
  );
}
