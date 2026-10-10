'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, HeartPulse, Users, Palette, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { usePageCopy } from '@/lib/hooks/use-page-copy';

interface Program {
    id: number;
    title: string;
    slug: string;
    description: string;
    price: string;
    duration: string;
    features: string[];
}

export default function PsychologyPage() {
    const copy = usePageCopy('psychology');
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/psychology/programs')
            .then(res => res.json())
            .then(data => {
                setPrograms(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, []);

    const icons = [HeartPulse, Users, Palette, Sparkles];

    // Функция для обрезания текста
    const truncateText = (text: string, maxLength: number = 100) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    };

    return (
        <main className="page-shell">
            <Navbar />
            
            <section className="page-hero">
                <div className="page-hero-inner">
                    <div className="page-kicker mb-7 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}><Sparkles className="h-4 w-4" />{copy.eyebrow}</div>
                    <h1 className="page-title text-5xl md:text-6xl font-semibold leading-[1.02] mb-7" style={{ color: 'var(--foreground)' }}>
                        {copy.title}
                    </h1>
                    <p className="page-lead text-lg leading-8" style={{ color: 'var(--foreground-secondary)' }}>
                        {copy.lead}
                    </p>
                </div>
            </section>

            <section className="px-4 pb-20 lg:pb-28">
                <div className="max-w-6xl mx-auto">
                    {loading ? (
                        <div className="content-panel rounded-[32px] py-20 text-center" style={{ color: 'var(--foreground-secondary)' }}>{copy.loading}</div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {programs.map((program, index) => {
                                const Icon = icons[index % icons.length];
                                const truncatedDescription = truncateText(program.description, 100);
                                
                                return (
                                    <Link
                                        key={program.id}
                                        href={`/psychology/${program.slug}`}
                                        className="block"
                                    >
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="service-card liquid-card rounded-[28px] p-6 cursor-pointer h-full flex flex-col"
                                            style={{ 
                                                minHeight: '320px'
                                            }}
                                        >
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'var(--primary-muted)' }}>
                                                    <Icon className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                                                </div>
                                                <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    {program.title}
                                                </h3>
                                            </div>
                                            
                                            <p className="text-sm flex-1" style={{ color: 'var(--foreground-secondary)' }}>
                                                {truncatedDescription}
                                            </p>

                                            <div className="mt-4">
                                                <span className="text-sm font-medium" style={{ color: 'var(--foreground-secondary)' }}>
                                                    Длительность:
                                                </span>
                                                <span className="ml-2 text-sm" style={{ color: 'var(--foreground)' }}>
                                                    {program.duration}
                                                </span>
                                            </div>

                                            {program.features && program.features.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {program.features.slice(0, 3).map((feature, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-xs px-2 py-1 rounded-full"
                                                            style={{ 
                                                                background: 'var(--bg-secondary)', 
                                                                color: 'var(--foreground-secondary)',
                                                                fontSize: '10px'
                                                            }}
                                                        >
                                                            {feature}
                                                        </span>
                                                    ))}
                                                    {program.features.length > 3 && (
                                                        <span className="text-xs px-2 py-1 rounded-full text-gray-400">
                                                            +{program.features.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                                <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                                                    {program.price}
                                                </span>
                                                <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--primary)' }}>
                                                    Подробнее <ArrowRight className="h-4 w-4" />
                                                </span>
                                            </div>
                                        </motion.div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
