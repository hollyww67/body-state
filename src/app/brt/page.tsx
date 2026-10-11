import type { Metadata } from "next";
import { db } from '@/lib/db';
import Navbar from "@/components/Navbar";
import BrtBookingForm from "@/components/BrtBookingForm";
import { Sparkles } from "lucide-react";
import { formatServicePrice, getServicePrice } from "@/lib/service-prices";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    try {
        const { data } = await db
            .from('page_content')
            .select('title, meta_description')
            .eq('slug', 'brt')
            .single();
        
        return {
            title: data?.title || "Биорезонансная программа (БРТ)",
            description: data?.meta_description || "Восстановление организма через биорезонансную терапию.",
        };
    } catch {
        return {
            title: "Биорезонансная программа (БРТ)",
            description: "Восстановление организма через биорезонансную терапию.",
        };
    }
}

export default async function BrtPage() {
    const servicePrice = await getServicePrice("brt");
    const priceLabel = formatServicePrice(servicePrice.price, servicePrice.prefix);
    let content = null;
    let title = "Биорезонансная программа";
    
    try {
        const { data: pageData } = await db
            .from('page_content')
            .select('content, title')
            .eq('slug', 'brt')
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
        subtitle: "Биорезонансная программа",
        description: "Биорезонансная терапия — это метод, основанный на воздействии электромагнитных колебаний, соответствующих частотам здоровых клеток организма.",
        features: [
            { label: "Описание", value: "Метод работает на клеточном уровне, восстанавливая нарушенные биоритмы." },
            { label: "Эффект", value: "Улучшение самочувствия, повышение тонуса, нормализация сна." },
            { label: "Длительность", value: "60 минут" },
            { label: "Стоимость", value: priceLabel },
        ]
    };
    
    const data = content || defaultContent;
    const features = (data.features || defaultContent.features).map((item: { label: string; value: string }) =>
        item.label.toLowerCase().includes("стоим") ? { ...item, value: priceLabel } : item
    );
    
    return (
        <main style={{ background: 'var(--bg)' }}>
            <Navbar />
            <section className="pt-32 pb-16 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                        <Sparkles className="w-4 h-4" />
                        {data.subtitle || defaultContent.subtitle}
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-6" style={{ color: 'var(--foreground)' }}>
                        {data.title || defaultContent.title}
                    </h1>
                    
                    <p className="text-lg leading-relaxed mb-4" style={{ color: 'var(--foreground-secondary)' }}>
                        {data.description || defaultContent.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-10">
                        {features.map((item: { label: string; value: string }) => (
                            <div key={item.label} className="glass-feature rounded-2xl p-5">
                                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{item.label}</p>
                                <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    
                    <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>Записаться на программу</h2>
                    <div className="glass-feature rounded-3xl p-7">
                        <BrtBookingForm price={servicePrice.price} />
                    </div>
                </div>
            </section>
        </main>
    );
}
