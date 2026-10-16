'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import FileUploader from '@/components/FileUploader';
import { AdminButton, AdminCard, AdminCheckbox, AdminFeedback, AdminInput, AdminSelect, AdminTextarea } from '@/components/admin/ui';

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
        <div className="p-4 md:p-8 max-w-4xl mx-auto text-[var(--bs-foreground)]">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/media" aria-label="Назад к результатам" className="bs-button bs-button--ghost bs-button--icon">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">
                    {isNew ? 'Добавить результат' : `Редактировать: ${form.title}`}
                </h1>
            </div>

            {error && (
                <AdminFeedback tone="destructive">{error}</AdminFeedback>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <AdminCard className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="media-title" className="block text-sm font-medium mb-1">Название *</label>
                        <AdminInput id="media-title"
                            type="text"
                            value={form.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="media-type" className="block text-sm font-medium mb-1">Тип</label>
                        <AdminSelect id="media-type"
                            value={form.media_type}
                            onChange={(e) => handleChange('media_type', e.target.value)}
                        >
                            <option value="photo">Фото</option>
                            <option value="video">Видео</option>
                        </AdminSelect>
                    </div>
                </div>

                <div>
                    <label htmlFor="media-description" className="block text-sm font-medium mb-1">Описание</label>
                    <AdminTextarea id="media-description"
                        value={form.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
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
                    <p className="text-xs mt-1" style={{ color: 'var(--bs-muted)' }}>
                        Если загружено видео, фото ДО/ПОСЛЕ не обязательны
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="media-category" className="block text-sm font-medium mb-1">Категория</label>
                        <AdminInput id="media-category"
                            type="text"
                            value={form.category || ''}
                            onChange={(e) => handleChange('category', e.target.value)}
                            placeholder="Например: Физическая реабилитация"
                        />
                    </div>
                    <div>
                        <label htmlFor="media-client" className="block text-sm font-medium mb-1">Имя клиента</label>
                        <AdminInput id="media-client"
                            type="text"
                            value={form.client_name || ''}
                            onChange={(e) => handleChange('client_name', e.target.value)}
                            placeholder="Анонимно"
                        />
                    </div>
                    <div>
                        <label htmlFor="media-service" className="block text-sm font-medium mb-1">Услуга</label>
                        <AdminInput id="media-service"
                            type="text"
                            value={form.service_type || ''}
                            onChange={(e) => handleChange('service_type', e.target.value)}
                            placeholder="Физическая реабилитация / БРТ / Психологическая реабилитация"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <AdminCheckbox
                        id="is_published"
                        checked={form.is_published}
                        onChange={(e) => handleChange('is_published', e.target.checked)}
                    />
                    <label htmlFor="is_published" className="text-sm font-medium">
                        Опубликовано на сайте
                    </label>
                </div>

                </AdminCard>
                <div className="flex flex-wrap gap-4 pt-4 border-t border-[var(--bs-border)]">
                    <AdminButton
                        type="submit"
                        disabled={saving}
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </AdminButton>
                    <Link
                        href="/admin/media"
                        className="bs-button bs-button--outline bs-button--md"
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </div>
    );
}
