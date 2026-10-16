'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import TipTapEditor from '@/components/TipTapEditor';
import { AdminButton, AdminCard, AdminCheckbox, AdminFeedback, AdminInput } from '@/components/admin/ui';

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
                <AdminFeedback tone="destructive">Ошибка: {error}</AdminFeedback>
                <Link href="/admin/psychology" className="bs-button bs-button--outline bs-button--md mt-4">
                    Вернуться к списку
                </Link>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto text-[var(--bs-foreground)]">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/psychology"
                    className="bs-button bs-button--ghost bs-button--icon"
                    aria-label="Назад к программам"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">
                    {isNew ? 'Создать программу' : `Редактировать: ${program.title}`}
                </h1>
            </div>

            {error && (
                <AdminFeedback tone="destructive">{error}</AdminFeedback>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <AdminCard className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="program-title" className="block text-sm font-medium mb-1">Название *</label>
                        <AdminInput id="program-title"
                            type="text"
                            value={program.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="program-slug" className="block text-sm font-medium mb-1">Slug (URL)</label>
                        <AdminInput id="program-slug" aria-describedby="program-slug-hint"
                            type="text"
                            value={program.slug}
                            onChange={(e) => handleChange('slug', e.target.value)}
                            placeholder="автоматически из названия"
                        />
                        <p id="program-slug-hint" className="text-xs text-[var(--bs-muted)] mt-1">URL: /psychology/{program.slug || '...'}</p>
                    </div>
                </div>

                {/* Визуальный редактор вместо textarea */}
                <div className="rounded-[var(--bs-radius-card)] border border-[var(--bs-border)] p-4">
                    <label className="block text-sm font-medium mb-1">Описание</label>
                    <TipTapEditor
                        content={program.description}
                        onChange={(content) => handleChange('description', content)}
                    />
                    <p className="text-xs text-[var(--bs-muted)] mt-1">
                        Используйте панель инструментов для форматирования текста
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="program-price" className="block text-sm font-medium mb-1">Цена *</label>
                        <AdminInput id="program-price" aria-describedby="program-price-hint"
                            type="text"
                            value={program.price}
                            onChange={(e) => handleChange('price', e.target.value)}
                            placeholder="От 3000 ₽"
                            required
                        />
                        <p id="program-price-hint" className="text-xs text-[var(--bs-muted)] mt-1">Можно писать: "3000 ₽", "От 3000 ₽"</p>
                    </div>
                    <div>
                        <label htmlFor="program-duration" className="block text-sm font-medium mb-1">Длительность *</label>
                        <AdminInput id="program-duration"
                            type="text"
                            value={program.duration}
                            onChange={(e) => handleChange('duration', e.target.value)}
                            placeholder="60 минут"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Особенности</label>
                    {program.features.map((feature, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <AdminInput aria-label={`Особенность ${index + 1}`}
                                type="text"
                                value={feature}
                                onChange={(e) => handleFeatureChange(index, e.target.value)}
                                className="flex-1 min-w-0"
                                placeholder={`Особенность ${index + 1}`}
                            />
                            <AdminButton variant="destructive" size="icon" aria-label={`Удалить особенность ${index + 1}`}
                                type="button"
                                onClick={() => removeFeature(index)}
                                disabled={program.features.length === 1}
                            >
                                <Trash2 className="w-4 h-4" />
                            </AdminButton>
                        </div>
                    ))}
                    <AdminButton variant="secondary"
                        type="button"
                        onClick={addFeature}
                    >
                        + Добавить особенность
                    </AdminButton>
                </div>

                <div className="flex items-center gap-3">
                    <AdminCheckbox
                        id="is_active"
                        checked={program.is_active}
                        onChange={(e) => handleChange('is_active', e.target.checked)}
                    />
                    <label htmlFor="is_active" className="text-sm font-medium">
                        Активна (отображается на сайте)
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
                        href="/admin/psychology"
                        className="bs-button bs-button--outline bs-button--md"
                    >
                        Отмена
                    </Link>
                </div>
            </form>
        </div>
    );
}
