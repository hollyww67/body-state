import type { Metadata } from "next";
import { db } from '@/lib/db';
import Navbar from "@/components/Navbar";
import BfmBookingForm from "@/components/BfmBookingForm";
import { ArrowDown, Check, Clock3, Sparkles, WalletCards } from "lucide-react";
import { formatServicePrice, getServicePrice } from "@/lib/service-prices";

// Отключаем статическую генерацию — контент всегда свежий
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    try {
        const { data } = await db
            .from('page_content')
            .select('title, meta_description')
            .eq('slug', 'bfm')
            .single();
        
        return {
            title: data?.title || "Физическая реабилитация",
            description: data?.meta_description || "Мягкое восстановление организма через работу с фасциальной системой.",
        };
    } catch {
        return {
            title: "Физическая реабилитация",
            description: "Мягкое восстановление организма через работу с фасциальной системой.",
        };
    }
}

export default async function BfmPage() {
    const servicePrice = await getServicePrice("bfm");
    const priceLabel = formatServicePrice(servicePrice.price, servicePrice.prefix);
    let content = null;
    let title = "Физическая реабилитация";
    
    try {
        const { data: pageData } = await db
            .from('page_content')
            .select('content, title')
            .eq('slug', 'bfm')
            .single();
        
        if (pageData) {
            title = pageData.title || title;
            if (pageData.content) {
                try {
                    content = JSON.parse(pageData.content);
                } catch {
                    content = { html: pageData.content };
                }
            }
        }
    } catch (error) {
        console.error('Page data fetch error:', error);
    }
    
    const defaultContent = {
        title: title,
        subtitle: "Физическая реабилитация",
        description: "Физическая реабилитация — это способ оздоровления человека, преимущественно базирующийся на работе соединительно-тканной и дыхательной систем организма, играющих ключевую роль в адаптации и регуляции жизнедеятельности человека. Работа направлена на снятие напряжений, спазмов и спастики различного происхождения.",
        features: [
            { label: "Описание", value: "Метод оказывает глубокое гармонизирующее воздействие на весь организм. Работа производится с телом как с единой системой." },
            { label: "Эффект", value: "В процессе сеанса происходит освобождение дыхания на клеточном уровне, гармонизация работы вегетативной нервной системы, сердечных ритмов, восстанавливается эластичность мышц и фасций, улучшается подвижность суставов, нормализуется сон, человек разгружается психоэмоционально." },
            { label: "Длительность", value: "90 минут" },
            { label: "Стоимость", value: priceLabel },
        ]
    };
    
    const data = content || defaultContent;
    const features = (data.features || defaultContent.features).map((item: { label: string; value: string }) =>
        item.label.toLowerCase().includes("стоим") ? { ...item, value: priceLabel } : item
    );
    
    return (
        <main className="page-shell">
            <Navbar />
            <section className="page-hero">
                <div className="page-hero-inner">
                    <div className="page-kicker rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] mb-7" style={{ color: 'var(--primary)' }}>
                        <Sparkles className="w-4 h-4" />
                        {data.subtitle || defaultContent.subtitle}
                    </div>
                    <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_.65fr]">
                        <div>
                            <h1 className="page-title text-5xl md:text-6xl font-semibold leading-[1.02] mb-7" style={{ color: 'var(--foreground)' }}>
                                {data.title || defaultContent.title}
                            </h1>
                            <p className="page-lead text-lg leading-8" style={{ color: 'var(--foreground-secondary)' }}>
                                {data.description || defaultContent.description}
                            </p>
                        </div>
                        <div className="content-panel rounded-[28px] p-6">
                            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Коротко о сеансе</p>
                            <div className="grid gap-4">
                                <div className="flex items-center gap-3"><Clock3 className="h-5 w-5" style={{ color: 'var(--primary)' }} /><div><p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>Длительность</p><p className="font-semibold">90 минут</p></div></div>
                                <div className="flex items-center gap-3"><WalletCards className="h-5 w-5" style={{ color: 'var(--primary)' }} /><div><p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>Стоимость</p><p className="font-semibold">{priceLabel}</p></div></div>
                                <a href="#booking" className="liquid-btn mt-2 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"><span className="relative z-10">Выбрать время</span><ArrowDown className="relative z-10 h-4 w-4" /></a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 pb-20 lg:pb-28">
                <div className="mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
                        {features.map((item: { label: string; value: string }) => (
                            <div key={item.label} className="service-card glass-feature rounded-[28px] p-6 md:p-7">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--primary)' }}>{item.label}</p>
                                <p className="relative z-10 text-base font-medium leading-7" style={{ color: 'var(--foreground)' }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div id="booking" className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-12">
                        <div>
                            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary)' }}>Следующий шаг</p>
                            <h2 className="text-3xl font-semibold tracking-[-0.035em] md:text-4xl" style={{ color: 'var(--foreground)' }}>Записаться на сеанс</h2>
                            <p className="mt-5 leading-7" style={{ color: 'var(--foreground-secondary)' }}>Выберите удобную дату и оплатите процедуру. Запись подтвердится автоматически.</p>
                            <div className="mt-7 grid gap-3 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                                {['Индивидуальный формат', 'Бережный темп', 'Понятные рекомендации после сеанса'].map((item) => <div key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}><Check className="h-3.5 w-3.5" /></span>{item}</div>)}
                            </div>
                        </div>
                        <div className="content-panel rounded-[32px] p-5 md:p-8">
                            <BfmBookingForm price={servicePrice.price} />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
