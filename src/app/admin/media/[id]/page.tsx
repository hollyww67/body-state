'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Image, Video } from 'lucide-react';
import FileUploader from '@/components/FileUploader';

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
}

export default function EditMediaPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<MediaItem>({
        id: 0,
        title: '',
        description: '',
        media_type: 'photo',
        before_image_url: '',
        after_image_url: '',
        video_url: '',
        thumbnail_url: '',
        category: '',
        client_name: '',
        service_type: '',
        is_published: true,
        sort_order: 0
    });

    useEffect(() => {
        if (isNew) {
            setLoading(false);
            return;
        }

        fetch(`/api/media/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Не найдено');
                return res.json();
            })
            .then(data => {
                setForm(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id, isNew]);

    const handleChange = (field: keyof MediaItem, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const url = isNew ? '/api/media' : `/api/media/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Ошибка сохранения');
            }

            router.push('/admin/media');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка');
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 animate-pulse">Загрузка...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/media" className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">
                    {isNew ? 'Добавить результат' : `Редактировать: ${form.title}`}
                </h1>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Название *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full p-3 border rounded-xl"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Тип</label>
                        <select
                            value={form.media_type}
                            onChange={(e) => handleChange('media_type', e.target.value)}
                            className="w-full p-3 border rounded-xl"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                        >
                            <option value="photo">Фото</option>
                            <option value="video">Видео</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Описание</label>
                    <textarea
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
                        className="w-full p-3 border rounded-xl"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Фото ДО</label>
                        <FileUploader
                            type="image"
                            label="Загрузить фото ДО"
                            currentUrl={form.before_image_url}
                            onUpload={(url) => handleChange('before_image_url', url)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Фото ПОСЛЕ</label>
                        <FileUploader
                            type="image"
                            label="Загрузить фото ПОСЛЕ"
                            currentUrl={form.after_image_url}
                            onUpload={(url) => handleChange('after_image_url', url)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Видео</label>
                    <FileUploader
                        type="video"
                        label="Загрузить видео"
                        currentUrl={form.video_url}
                        onUpload={(url) => handleChange('video_url', url)}
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                        Если загружено видео, фото ДО/ПОСЛЕ не обязательны
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Категория</label>
                        <input
                            type="text"
                            value={form.category || ''}
                            onChange={(e) => handleChange('category', e.target.value)}
                            className="w-full p-3 border rounded-xl"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="Например: БФМ"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Имя клиента</label>
                        <input
                            type="text"
                            value={form.client_name || ''}
                            onChange={(e) => handleChange('client_name', e.target.value)}
                            className="w-full p-3 border rounded-xl"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="Анонимно"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Услуга</label>
                        <input
                            type="text"
                            value={form.service_type || ''}
                            onChange={(e) => handleChange('service_type', e.target.value)}
                            className="w-full p-3 border rounded-xl"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="БФМ / БРТ / Психология"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_published"
                        checked={form.is_published}
                        onChange={(e) => handleChange('is_published', e.target.checked)}
                        className="w-4 h-4"
                    />
                    <label htmlFor="is_published" className="text-sm font-medium">
                        Опубликовано на сайте
                    </label>
                </div>

                <div className="flex gap-4 pt-4 border-t">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl flex items-center gap-2 hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <Link
                        href="/admin/media"
                        className="px-6 py-3 border rounded-xl hover:bg-gray-50 transition"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </div>
    );
}
