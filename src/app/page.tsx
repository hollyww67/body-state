"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Heart, Layers, HandHeart } from "lucide-react";
import Navbar from "@/components/Navbar";
import EditorialReviews from "@/components/EditorialReviews";
import SiteImage from "@/components/SiteImage";
import { publicImageSource } from "@/lib/public-image";
import { usePageCopy } from "@/lib/hooks/use-page-copy";
import "./home-editorial.css";

export default function HomePage() {
  const copy = usePageCopy("home");
  const heroImage = publicImageSource(copy.heroImage);
  const specialistImage = publicImageSource(copy.specialistImage);
  const services = [
    { number: "01", title: copy.method2Title, description: copy.method2Text, image: publicImageSource(copy.physicalImage), href: "/bfm#booking", label: "О физической реабилитации", Icon: HandHeart },
    { number: "02", title: copy.method1Title, description: copy.method1Text, image: publicImageSource(copy.psychologyImage), href: "/psychology", label: "О психологической реабилитации", Icon: Heart },
  ];
  const steps = [
    { number: "01", title: copy.process1Title, description: copy.process1Text },
    { number: "02", title: copy.process2Title, description: copy.process2Text },
    { number: "03", title: copy.process3Title, description: copy.process3Text },
    { number: "04", title: copy.process4Title, description: copy.process4Text },
  ];

  return (
    <>
      <Navbar />
      <main className="quiet-home" id="main-content">
        <section className="qh-hero" aria-labelledby="qh-title">
          <div className="qh-container qh-hero-grid">
            <div className="qh-hero-copy">
              <p className="qh-eyebrow">{copy.heroEyebrow}</p>
              <h1 id="qh-title"><span>{copy.heroTitle}</span><span>{copy.heroAccent}</span></h1>
              <p className="qh-lead">{copy.heroDescription}</p>
              <div className="qh-actions">
                <Link className="qh-button" href="/rehabilitation#booking">{copy.heroButton}<ArrowRight size={18} aria-hidden="true" /></Link>
                <Link className="qh-text-link" href="/about-rehabilitation">{copy.heroSecondary}<ArrowUpRight size={18} aria-hidden="true" /></Link>
              </div>
            </div>
            <figure className={`qh-hero-figure${heroImage ? " qh-hero-figure--photo" : ""}`}>
              {heroImage ? <SiteImage src={heroImage} alt={copy.heroImageAlt} width={1200} height={1200} priority sizes="(max-width: 767px) 100vw, 50vw" className="qh-hero-photo" /> : <>
              <div className="qh-figure-heading"><span>Body State</span><span>Тело · Состояние</span></div>
              <p className="qh-figure-message">Тело.<br />Состояние.<br />Внимание.</p>
              <figcaption>Временная композиция вместо фотографии.<br />Здесь будет согласованный снимок пространства Body State.</figcaption></>}
            </figure>
          </div>
          <div className="qh-container qh-principles" aria-label="Подход к работе">
            <div><Layers size={22} strokeWidth={1.3} aria-hidden="true" /><span>Тело и состояние<small>Два направления работы</small></span></div>
            <div><Heart size={22} strokeWidth={1.3} aria-hidden="true" /><span>Внимание к человеку<small>Начинаем с вашего запроса</small></span></div>
            <div><HandHeart size={22} strokeWidth={1.3} aria-hidden="true" /><span>Индивидуальный подход<small>С учётом вашего состояния</small></span></div>
          </div>
        </section>

        <section className="qh-section qh-services" id="directions" aria-labelledby="qh-services-title">
          <div className="qh-container">
            <div className="qh-section-heading"><div><p className="qh-eyebrow">01 / Направления</p><h2 id="qh-services-title">{copy.methodsTitle}</h2></div><p>{copy.methodsDescription}</p></div>
            <div className="qh-service-grid">
              {services.map(({ Icon, ...service }) => (
                <article className="qh-service" key={service.number}>
                  {service.image && <SiteImage src={service.image} alt="" width={800} height={560} className="qh-service-photo" />}
                  <div className="qh-service-top"><span className="qh-eyebrow">{service.number} / Body State</span><Icon size={32} strokeWidth={1.1} aria-hidden="true" /></div>
                  <h3>{service.title}</h3><p>{service.description}</p>
                  <Link href={service.href} className="qh-text-link" aria-label={service.label}>Подробнее<ArrowRight size={18} aria-hidden="true" /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="qh-section qh-philosophy" aria-labelledby="qh-philosophy-title">
          <div className="qh-container qh-split">
            <div><p className="qh-eyebrow">02 / Философия</p><h2 id="qh-philosophy-title">{copy.philosophyTitle}</h2><Link href="/about-rehabilitation" className="qh-text-link">О подходе Body State<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
            <div className="qh-philosophy-copy"><p className="qh-statement">{copy.philosophy}</p><p>{copy.philosophyNote}</p></div>
          </div>
        </section>

        <section className="qh-section qh-process" aria-labelledby="qh-process-title">
          <div className="qh-container">
            <div className="qh-section-heading"><div><p className="qh-eyebrow">03 / Как проходит работа</p><h2 id="qh-process-title">{copy.processTitle}</h2></div><p>{copy.processDescription}</p></div>
            <ol className="qh-steps">{steps.map((step) => <li key={step.number}><span className="qh-step-number" aria-hidden="true">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
            <Link href="/rehabilitation#booking" className="qh-text-link qh-process-link">Выбрать направление и время<ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="qh-section qh-specialist" aria-labelledby="qh-specialist-title">
          <div className="qh-container qh-split">
            <div><p className="qh-eyebrow">04 / Специалист</p><h2 id="qh-specialist-title">{copy.specialistTitle}</h2>{specialistImage && <SiteImage src={specialistImage} alt={copy.specialistName} width={640} height={800} className="qh-specialist-photo" />}</div>
            <div className="qh-specialist-copy"><p className="qh-eyebrow">Индивидуальная работа · Хотьково</p><h3>{copy.specialistName}</h3><p>{copy.specialistDescription}</p><Link href="/about" className="qh-text-link">Познакомиться со специалистом<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section className="qh-section qh-reviews" aria-labelledby="qh-reviews-title">
          <div className="qh-container qh-split">
            <div><p className="qh-eyebrow">05 / Отзывы</p><h2 id="qh-reviews-title">{copy.reviewsTitle}</h2><Link href="/reviews" className="qh-text-link">Все отзывы<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
            <div className="qh-reviews-content"><EditorialReviews /></div>
          </div>
        </section>

        <section className="qh-appointment" aria-labelledby="qh-appointment-title">
          <div className="qh-container qh-appointment-inner"><p className="qh-eyebrow">06 / Первый шаг</p><h2 id="qh-appointment-title">{copy.ctaTitle}</h2><p>{copy.ctaDescription}</p><div className="qh-actions"><Link href="/rehabilitation#booking" className="qh-button">{copy.ctaButton}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/contact" className="qh-text-link">Связаться и задать вопрос<ArrowUpRight size={18} aria-hidden="true" /></Link></div></div>
        </section>
      </main>
    </>
  );
}
