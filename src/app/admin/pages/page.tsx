'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit, Plus, Eye, Trash2 } from 'lucide-react';

interface PageContent {
    id: number;
    slug: string;
    title: string;
    content: string;
    meta_description: string | null;
    meta_keywords: string | null;
    is_active: boolean;
    updated_at: string;
}

export default function PagesAdmin() {
    const router = useRouter();
    const [pages, setPages] = useState<PageContent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/page-content')
            .then(res => res.json())
            .then(data => {
                setPages(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-8">Загрузка...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Управление страницами</h1>
                <button
                    onClick={() => router.push('/admin/pages/new')}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Создать страницу
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead style={{ background: 'var(--bg-secondary)' }}>
                        <tr>
                            <th className="text-left p-3">Страница</th>
                            <th className="text-left p-3">Заголовок</th>
                            <th className="text-left p-3">Статус</th>
                            <th className="text-left p-3">Обновлено</th>
                            <th className="text-left p-3">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pages.map((page) => (
                            <motion.tr
                                key={page.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="border-b"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                <td className="p-3 font-medium">/{page.slug}</td>
                                <td className="p-3">{page.title || '—'}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        page.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {page.is_active ? 'Активна' : 'Черновик'}
                                    </span>
                                </td>
                                <td className="p-3 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                                    {new Date(page.updated_at).toLocaleString('ru-RU')}
                                </td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => router.push(`/admin/pages/${page.slug}`)}
                                            className="p-2 rounded-lg hover:bg-blue-50"
                                            title="Редактировать"
                                        >
                                            <Edit className="w-4 h-4 text-blue-500" />
                                        </button>
                                        <button
                                            onClick={() => window.open(`/page/${page.slug}`, '_blank')}
                                            className="p-2 rounded-lg hover:bg-gray-100"
                                            title="Просмотреть"
                                        >
                                            <Eye className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
