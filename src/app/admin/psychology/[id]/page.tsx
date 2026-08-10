'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import TipTapEditor from '@/components/TipTapEditor';

interface Program {
    id: number;
    title: string;
    slug: string;
    description: string;
    price: string;
    duration: string;
    features: string[];
    image_url: string | null;
    is_active: boolean;
    sort_order: number;
}

export default function EditPsychologyPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const isNew = id === 'new';

    const [program, setProgram] = useState<Program>({
        id: 0,
        title: '',
        slug: '',
        description: '',
        price: '',
        duration: '',
        features: [''],
        image_url: null,
        is_active: true,
        sort_order: 0
    });
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isNew) return;

        fetch(`/api/admin/psychology/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Программа не найдена');
                return res.json();
            })
            .then(data => {
                setProgram({
                    ...data,
                    price: data.price?.toString() || ''
                });
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id, isNew]);

    const handleChange = (field: keyof Program, value: any) => {
        setProgram(prev => ({ ...prev, [field]: value }));
    };

    const handleFeatureChange = (index: number, value: string) => {
        const newFeatures = [...program.features];
        newFeatures[index] = value;
        setProgram(prev => ({ ...prev, features: newFeatures }));
    };

    const addFeature = () => {
        setProgram(prev => ({ ...prev, features: [...prev.features, ''] }));
    };

    const removeFeature = (index: number) => {
        const newFeatures = program.features.filter((_, i) => i !== index);
        setProgram(prev => ({ ...prev, features: newFeatures }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (!program.slug && program.title) {
            program.slug = program.title.toLowerCase().replace(/\s+/g, '-');
        }

        const url = isNew ? '/api/admin/psychology' : `/api/admin/psychology/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...program,
                    features: program.features.filter(f => f.trim() !== ''),
                    price: program.price || '0'
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Ошибка сохранения');
            }

            router.push('/admin/psychology');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse">Загрузка программы...</div>
            </div>
        );
    }

    if (error && !isNew) {
        return (
            <div className="p-8">
                <div className="text-red-500">Ошибка: {error}</div>
                <Link href="/admin/psychology" className="text-blue-500 hover:underline mt-4 inline-block">
                    Вернуться к списку
                </Link>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/psychology"
                    className="p-2 rounded-lg hover:bg-gray-100 transition"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">
                    {isNew ? 'Создать программу' : `Редактировать: ${program.title}`}
                </h1>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Название *</label>
                        <input
                            type="text"
                            value={program.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                        <input
                            type="text"
                            value={program.slug}
                            onChange={(e) => handleChange('slug', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="автоматически из названия"
                        />
                        <p className="text-xs text-gray-500 mt-1">URL: /psychology/{program.slug || '...'}</p>
                    </div>
                </div>

                {/* Визуальный редактор вместо textarea */}
                <div>
                    <label className="block text-sm font-medium mb-1">Описание</label>
                    <TipTapEditor
                        content={program.description}
                        onChange={(content) => handleChange('description', content)}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Используйте панель инструментов для форматирования текста
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Цена *</label>
                        <input
                            type="text"
                            value={program.price}
                            onChange={(e) => handleChange('price', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="От 3000 ₽"
                            required
                        />
                        <p className="text-xs text-gray-400 mt-1">Можно писать: "3000 ₽", "От 3000 ₽"</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Длительность *</label>
                        <input
                            type="text"
                            value={program.duration}
                            onChange={(e) => handleChange('duration', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                            placeholder="60 минут"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Особенности</label>
                    {program.features.map((feature, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={feature}
                                onChange={(e) => handleFeatureChange(index, e.target.value)}
                                className="flex-1 p-2 border rounded-lg"
                                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--foreground)' }}
                                placeholder={`Особенность ${index + 1}`}
                            />
                            <button
                                type="button"
                                onClick={() => removeFeature(index)}
                                className="px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                disabled={program.features.length === 1}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addFeature}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                        + Добавить особенность
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_active"
                        checked={program.is_active}
                        onChange={(e) => handleChange('is_active', e.target.checked)}
                        className="w-4 h-4"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium">
                        Активна (отображается на сайте)
                    </label>
                </div>

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
                        href="/admin/psychology"
                        className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </div>
    );
}
