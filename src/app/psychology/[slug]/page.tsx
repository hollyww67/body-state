'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface Program {
    id: number;
    title: string;
    description: string;
    price: string;
    duration: string;
    features: string[];
}

export default function ProgramPage() {
    const params = useParams();
    const slug = params.slug as string;
    
    const [program, setProgram] = useState<Program | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        
        fetch(`/api/psychology/programs/${slug}`)
            .then(res => res.json())
            .then(data => {
                setProgram(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, [slug]);

    if (loading) {
        return (
            <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
                <Navbar />
                <div className="pt-32 px-4 text-center">Загрузка...</div>
            </main>
        );
    }

    if (!program) {
        return (
            <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
                <Navbar />
                <div className="pt-32 px-4 text-center">
                    <h1 className="text-2xl">Программа не найдена</h1>
                    <Link href="/psychology" className="text-blue-500 hover:underline mt-4 inline-block">
                        Вернуться к программам
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
            <Navbar />
            
            <section className="pt-32 pb-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <Link href="/psychology" className="inline-flex items-center gap-2 mb-8" style={{ color: 'var(--primary)' }}>
                        <ArrowLeft className="w-4 h-4" />
                        Назад к программам
                    </Link>

                    <h1 className="text-3xl lg:text-4xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
                        {program.title}
                    </h1>
                    
                    {/* Описание с HTML от TipTap */}
                    <div 
                        className="prose-content"
                        style={{ 
                            lineHeight: '1.8',
                            color: 'var(--foreground-secondary)'
                        }}
                        dangerouslySetInnerHTML={{ 
                            __html: program.description 
                        }} 
                    />

                    <div className="flex flex-wrap gap-6 mb-8 p-6 rounded-2xl mt-8" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                            <span style={{ color: 'var(--foreground)' }}>{program.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                                {program.price}
                            </span>
                        </div>
                    </div>

                    {program.features && program.features.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Что входит:</h3>
                            <ul className="space-y-3">
                                {program.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: 'var(--primary)' }} />
                                        <span style={{ color: 'var(--foreground-secondary)' }}>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 mt-8">
                        <button 
                            className="px-8 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg"
                            style={{ background: 'var(--primary)' }}
                            onClick={() => alert('Запись на программу (в разработке)')}
                        >
                            Записаться на программу
                        </button>
                        <Link
                            href="/contact"
                            className="px-8 py-3 rounded-xl border font-medium text-center transition-all hover:bg-gray-50"
                            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                            Связаться с нами
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
