'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

interface Feature {
    label: string;
    value: string;
}

interface PageContent {
    title: string;
    subtitle: string;
    description: string;
    features: Feature[];
    meta_description: string;
    meta_keywords: string;
    is_active: boolean;
}

export default function EditPageAdmin() {
    const router = useRouter();
    const params = useParams();
    const slug = params.slug as string;
    const isNew = slug === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Основные поля
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState<Feature[]>([
        { label: '', value: '' }
    ]);
    const [metaDescription, setMetaDescription] = useState('');
    const [metaKeywords, setMetaKeywords] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (isNew) {
            setLoading(false);
            return;
        }

        fetch(`/api/page-content/${slug}`)
            .then(res => {
                if (!res.ok) throw new Error('Страница не найдена');
                return res.json();
            })
            .then(data => {
                setTitle(data.title || '');
                setMetaDescription(data.meta_description || '');
                setMetaKeywords(data.meta_keywords || '');
                setIsActive(data.is_active ?? true);
                
                // Парсим content как JSON
                if (data.content) {
                    try {
                        const parsed = JSON.parse(data.content);
                        setSubtitle(parsed.subtitle || '');
                        setDescription(parsed.description || '');
                        setFeatures(parsed.features || [{ label: '', value: '' }]);
                    } catch {
                        // Если не JSON — оставляем как есть
                        setDescription(data.content);
                    }
                }
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [slug, isNew]);

    const handleFeatureChange = (index: number, field: keyof Feature, value: string) => {
        const newFeatures = [...features];
        newFeatures[index][field] = value;
        setFeatures(newFeatures);
    };

    const addFeature = () => {
        setFeatures([...features, { label: '', value: '' }]);
    };

    const removeFeature = (index: number) => {
        if (features.length === 1) return;
        setFeatures(features.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        // Формируем content как JSON
        const content = JSON.stringify({
            subtitle,
            description,
            features: features.filter(f => f.label.trim() || f.value.trim())
        });

        const url = isNew ? '/api/page-content' : `/api/page-content/${slug}`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: isNew ? title.toLowerCase().replace(/\s+/g, '-') : slug,
                    title,
                    content,
                    meta_description: metaDescription,
                    meta_keywords: metaKeywords,
                    is_active: isActive
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Ошибка сохранения');
            }

            router.push('/admin/pages');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка');
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8">Загрузка...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/pages" className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">
                    {isNew ? 'Создать страницу' : `Редактирование: ${slug}`}
                </h1>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* SEO и общие поля */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Заголовок (H1)</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Подзаголовок (над H1)</label>
                        <input
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            placeholder="Например: Биофасциальная модуляция"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Описание (основной текст)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            className="w-full p-2 border rounded-lg"
                        />
                    </div>
                </div>

                {/* Карточки (features) */}
                <div className="border-t pt-6">
                    <label className="block text-sm font-medium mb-3">Карточки (label / value)</label>
                    {features.map((feature, index) => (
                        <div key={index} className="flex gap-3 mb-3 items-start">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={feature.label}
                                    onChange={(e) => handleFeatureChange(index, 'label', e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="Label (например: Длительность)"
                                />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={feature.value}
                                    onChange={(e) => handleFeatureChange(index, 'value', e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="Value (например: 45 минут)"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeFeature(index)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                disabled={features.length === 1}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addFeature}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    >
                        <Plus className="w-4 h-4" />
                        Добавить карточку
                    </button>
                </div>

                {/* SEO */}
                <div className="border-t pt-6">
                    <h3 className="font-medium mb-3">SEO</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Meta Description</label>
                            <textarea
                                value={metaDescription}
                                onChange={(e) => setMetaDescription(e.target.value)}
                                rows={2}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Meta Keywords</label>
                            <input
                                type="text"
                                value={metaKeywords}
                                onChange={(e) => setMetaKeywords(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Активность */}
                <div className="flex items-center gap-3 pt-4">
                    <input
                        type="checkbox"
                        id="is_active"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium">
                        Активна (отображается на сайте)
                    </label>
                </div>

                {/* Кнопки */}
                <div className="flex gap-4 pt-4 border-t">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <Link
                        href="/admin/pages"
                        className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </div>
    );
}
