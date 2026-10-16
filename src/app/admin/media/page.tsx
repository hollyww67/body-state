'use client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

import SiteImage from '@/components/SiteImage';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
    Plus, Edit, Trash2, Image as ImageIcon, Video, EyeOff, User, Tag
} from 'lucide-react';
import Link from 'next/link';
import { AdminBadge, AdminButton, AdminFeedback } from '@/components/admin/ui';

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
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
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
        } catch {
            setError('Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {

        try {
            const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setItems(items.filter(item => item.id !== id));
            } else {
                toast.error('Ошибка удаления');
            }
        } catch {
            toast.error('Ошибка удаления');
        }
    };

    if (loading) {
        return <div className="p-8 animate-pulse">Загрузка...</div>;
    }

    if (error) {
        return <div className="p-4 md:p-8"><AdminFeedback tone="destructive">{error}</AdminFeedback></div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto text-[var(--bs-foreground)]">
      {deleteTarget && <AdminConfirmDialog title={`Удалить "${deleteTarget.title}"?`} onCancel={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget.id)}><p>{deleteTarget.title}</p></AdminConfirmDialog>}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <ImageIcon aria-hidden="true" className="w-6 h-6 text-[var(--bs-primary)]" />
                        До / После
                    </h1>
                    <p className="text-sm text-[var(--bs-muted)] mt-1">
                        Фото и видео результатов
                    </p>
                </div>
                <Link
                    href="/admin/media/new"
                    className="bs-button bs-button--primary bs-button--md"
                >
                    <Plus className="w-4 h-4" />
                    Добавить
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="bs-card text-center py-12 text-[var(--bs-muted)]">
                    <ImageIcon aria-hidden="true" className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Нет фото и видео</p>
                    <Link href="/admin/media/new" className="bs-button bs-button--ghost bs-button--md mt-2">
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
                            className="bs-card overflow-hidden"
                            style={{ padding: 0 }}
                        >
                            {/* Превью */}
                            <div className="relative aspect-[4/3] bg-[var(--bs-surface-muted)]">
                                {item.media_type === 'photo' ? (
                                    <SiteImage
                                        src={item.after_image_url || item.before_image_url || '/placeholder.jpg'}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[var(--bs-surface-muted)]">
                                        <Video className="w-12 h-12 text-[var(--bs-muted)]" />
                                    </div>
                                )}
                                {!item.is_published && (
                                    <AdminBadge className="absolute top-2 right-2" tone="warning">
                                        <EyeOff className="w-3 h-3" />
                                        Скрыто
                                    </AdminBadge>
                                )}
                                <AdminBadge className="absolute top-2 left-2" tone="info">
                                    {item.media_type === 'photo' ? (
                                        <ImageIcon aria-hidden="true" className="w-3 h-3" />
                                    ) : (
                                        <Video className="w-3 h-3" />
                                    )}
                                    {item.media_type === 'photo' ? 'Фото' : 'Видео'}
                                </AdminBadge>
                            </div>

                            {/* Информация */}
                            <div className="p-4">
                                <h3 className="font-semibold truncate">{item.title}</h3>
                                {item.client_name && (
                                    <p className="text-sm text-[var(--bs-muted)] flex items-center gap-1 mt-1">
                                        <User className="w-3 h-3" />
                                        {item.client_name}
                                    </p>
                                )}
                                {item.category && (
                                    <p className="text-sm text-[var(--bs-muted)] flex items-center gap-1">
                                        <Tag className="w-3 h-3" />
                                        {item.category}
                                    </p>
                                )}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--bs-border)]">
                                    <span className="text-xs text-[var(--bs-muted)]">
                                        {new Date(item.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/admin/media/${item.id}`}
                                            className="bs-button bs-button--ghost bs-button--icon"
                                            aria-label={`Редактировать ${item.title}`}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                        <AdminButton type="button" variant="destructive" size="icon"
                                            aria-label={`Удалить ${item.title}`}
                                            onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </AdminButton>
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
