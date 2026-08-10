import type { Metadata } from "next";
import { createClient } from '@supabase/supabase-js';
import Navbar from "@/components/Navbar";
import BfmBookingForm from "@/components/BfmBookingForm";
import { Sparkles } from "lucide-react";

// Отключаем статическую генерацию — контент всегда свежий
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    try {
        const { data } = await supabase
            .from('page_content')
            .select('title, meta_description')
            .eq('slug', 'bfm')
            .single();
        
        return {
            title: data?.title || "Биофасциальная модуляция (БФМ)",
            description: data?.meta_description || "Мягкое восстановление организма через работу с фасциальной системой.",
        };
    } catch {
        return {
            title: "Биофасциальная модуляция (БФМ)",
            description: "Мягкое восстановление организма через работу с фасциальной системой.",
        };
    }
}

export default async function BfmPage() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    let content = null;
    let title = "Биофасциальная модуляция";
    
    try {
        const { data: pageData } = await supabase
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
        subtitle: "Биофасциальная модуляция",
        description: "Биофасциальная модуляция — это способ оздоровления человека, преимущественно базирующийся на работе соединительно-тканной и дыхательной системами организма, играющими ключевую роль в адаптации и регуляции жизнедеятельности человека, направленный на снятие напряжений, спазмов и спастики любого происхождения, независимо от причин и времени их появления.",
        features: [
            { label: "Описание", value: "Метод оказывает глубокое гармонизирующее воздействие на весь организм. Работа производится с телом как с единой системой." },
            { label: "Эффект", value: "В процессе сеанса происходит освобождение дыхания на клеточном уровне, гармонизация работы вегетативной нервной системы, сердечных ритмов, восстанавливается эластичность мышц и фасций, улучшается подвижность суставов, нормализуется сон, человек разгружается психоэмоционально." },
            { label: "Длительность", value: "45 минут" },
            { label: "Стоимость", value: "От 3000 ₽" },
        ]
    };
    
    const data = content || defaultContent;
    const features = data.features || defaultContent.features;
    
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
                    
                    <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>Записаться на сеанс</h2>
                    <div className="glass-feature rounded-3xl p-7">
                        <BfmBookingForm />
                    </div>
                </div>
            </section>
        </main>
    );
}
