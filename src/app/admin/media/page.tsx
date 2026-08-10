'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Plus, Edit, Trash2, Image, Video, Eye, EyeOff,
    Upload, X, Check, Calendar, User, Tag
} from 'lucide-react';
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
    sort_order: number;
    created_at: string;
}

export default function MediaAdmin() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/media');
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, title: string) => {
        if (!confirm(`Удалить "${title}"?`)) return;

        try {
            const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setItems(items.filter(item => item.id !== id));
            } else {
                alert('Ошибка удаления');
            }
        } catch (err) {
            alert('Ошибка удаления');
        }
    };

    if (loading) {
        return <div className="p-8 animate-pulse">Загрузка...</div>;
    }

    if (error) {
        return <div className="p-8 text-red-500">{error}</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Image className="w-6 h-6 text-teal-500" />
                        До / После
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Фото и видео результатов
                    </p>
                </div>
                <Link
                    href="/admin/media/new"
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl flex items-center gap-2 hover:shadow-lg transition"
                >
                    <Plus className="w-4 h-4" />
                    Добавить
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border rounded-2xl">
                    <Image className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Нет фото и видео</p>
                    <Link href="/admin/media/new" className="text-teal-500 hover:underline mt-2 inline-block">
                        Добавить первый результат
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border rounded-2xl overflow-hidden hover:shadow-lg transition"
                        >
                            {/* Превью */}
                            <div className="relative aspect-[4/3] bg-gray-100">
                                {item.media_type === 'photo' ? (
                                    <img
                                        src={item.after_image_url || item.before_image_url || '/placeholder.jpg'}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                        <Video className="w-12 h-12 text-white/50" />
                                    </div>
                                )}
                                {!item.is_published && (
                                    <div className="absolute top-2 right-2 bg-gray-800/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <EyeOff className="w-3 h-3" />
                                        Скрыто
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    {item.media_type === 'photo' ? (
                                        <Image className="w-3 h-3" />
                                    ) : (
                                        <Video className="w-3 h-3" />
                                    )}
                                    {item.media_type === 'photo' ? 'Фото' : 'Видео'}
                                </div>
                            </div>

                            {/* Информация */}
                            <div className="p-4">
                                <h3 className="font-semibold truncate">{item.title}</h3>
                                {item.client_name && (
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                        <User className="w-3 h-3" />
                                        {item.client_name}
                                    </p>
                                )}
                                {item.category && (
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Tag className="w-3 h-3" />
                                        {item.category}
                                    </p>
                                )}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t">
                                    <span className="text-xs text-gray-400">
                                        {new Date(item.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/admin/media/${item.id}`}
                                            className="p-2 rounded-lg hover:bg-blue-50 transition"
                                        >
                                            <Edit className="w-4 h-4 text-blue-500" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(item.id, item.title)}
                                            className="p-2 rounded-lg hover:bg-red-50 transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
