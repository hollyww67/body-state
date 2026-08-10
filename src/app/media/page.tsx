import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import { Image as ImageIcon, Video, User, Tag, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface MediaItem {
    id: number;
    title: string;
    description: string;
    media_type: 'photo' | 'video';
    before_image_url: string | null;
    after_image_url: string | null;
    video_url: string | null;
    thumbnail_url: string | null;
    category: string | null;
    client_name: string | null;
    service_type: string | null;
    is_published: boolean;
    created_at: string;
}

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: items } = await supabase
        .from('media_gallery')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

    const mediaItems = items || [];

    return (
        <main style={{ background: 'var(--bg)' }}>
            <Navbar />
            <section className="pt-32 pb-16 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                            Результаты наших клиентов
                        </h1>
                        <p className="text-lg" style={{ color: 'var(--foreground-secondary)' }}>
                            Фото и видео до и после прохождения программ
                        </p>
                    </div>

                    {mediaItems.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-400">Пока нет результатов</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {mediaItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="group rounded-2xl overflow-hidden border transition hover:shadow-xl"
                                    style={{ 
                                        background: 'var(--card-bg)',
                                        borderColor: 'var(--border)'
                                    }}
                                >
                                    {/* Изображение */}
                                    <div className="relative aspect-[4/3] overflow-hidden">
                                        {item.media_type === 'photo' ? (
                                            <img
                                                src={item.after_image_url || item.before_image_url || '/placeholder.jpg'}
                                                alt={item.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                                                <Video className="w-12 h-12 opacity-40" style={{ color: 'var(--foreground-secondary)' }} />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                            {item.media_type === 'photo' ? (
                                                <ImageIcon className="w-3 h-3" />
                                            ) : (
                                                <Video className="w-3 h-3" />
                                            )}
                                            {item.media_type === 'photo' ? 'Фото' : 'Видео'}
                                        </div>
                                    </div>

                                    {/* Контент */}
                                    <div className="p-5">
                                        <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className="text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                                                {item.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                                            {item.client_name && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {item.client_name}
                                                </span>
                                            )}
                                            {item.category && (
                                                <span className="flex items-center gap-1">
                                                    <Tag className="w-3 h-3" />
                                                    {item.category}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.created_at).toLocaleDateString('ru-RU')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
