'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Edit, Eye, Trash2, HeartPulse, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Program {
    id: number;
    title: string;
    slug: string;
    description: string;
    price: string;
    duration: string;
    features: string[];
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

// Компонент для перетаскиваемой строки
function SortableProgramRow({ program, onDelete, onEdit, onView }: { 
    program: Program; 
    onDelete: (id: number, title: string) => void;
    onEdit: (id: number) => void;
    onView: (slug: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: program.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr 
            ref={setNodeRef} 
            style={style} 
            className={`border-b hover:bg-gray-50 transition ${isDragging ? 'shadow-lg' : ''}`}
        >
            <td className="p-3">
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="cursor-grab hover:cursor-grabbing inline-flex p-1 rounded hover:bg-gray-100 transition"
                >
                    <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
            </td>
            <td className="p-3 font-medium">{program.title}</td>
            <td className="p-3">{program.price}</td>
            <td className="p-3">{program.duration}</td>
            <td className="p-3">
                <span className={`px-2 py-1 rounded-full text-xs ${
                    program.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-500'
                }`}>
                    {program.is_active ? 'Активна' : 'Черновик'}
                </span>
            </td>
            <td className="p-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => onEdit(program.id)}
                        className="p-2 rounded-lg hover:bg-blue-50 transition"
                        title="Редактировать"
                    >
                        <Edit className="w-4 h-4 text-blue-500" />
                    </button>
                    <button
                        onClick={() => onView(program.slug)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition"
                        title="Просмотреть"
                    >
                        <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                        onClick={() => onDelete(program.id, program.title)}
                        className="p-2 rounded-lg hover:bg-red-50 transition"
                        title="Удалить"
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

export default function PsychologyAdmin() {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchPrograms();
    }, []);

    const fetchPrograms = async () => {
        try {
            const res = await fetch('/api/admin/psychology');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setPrograms(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, title: string) => {
        if (!confirm(`Удалить программу "${title}"?`)) return;

        try {
            const res = await fetch(`/api/admin/psychology/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Ошибка удаления');

            setPrograms(programs.filter(p => p.id !== id));
        } catch (err) {
            alert('Не удалось удалить программу');
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setIsReordering(true);

            const oldIndex = programs.findIndex((p) => p.id === active.id);
            const newIndex = programs.findIndex((p) => p.id === over.id);

            const newPrograms = arrayMove(programs, oldIndex, newIndex);
            setPrograms(newPrograms);

            // Обновляем sort_order на сервере
            try {
                const reorderData = newPrograms.map((p, index) => ({
                    id: p.id,
                    sort_order: index,
                }));

                const res = await fetch('/api/admin/psychology/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reorderData),
                });

                if (!res.ok) {
                    throw new Error('Ошибка сохранения порядка');
                }
            } catch (err) {
                console.error('Reorder error:', err);
                alert('Не удалось сохранить порядок. Обновите страницу.');
                fetchPrograms();
            } finally {
                setIsReordering(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse">Загрузка программ...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="text-red-500">Ошибка: {error}</div>
                <button 
                    onClick={fetchPrograms} 
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
                >
                    Повторить
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Программы психологии</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Всего программ: {programs.length}
                        {isReordering && ' (сохранение порядка...)'}
                    </p>
                </div>
                <Link
                    href="/admin/psychology/new"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition"
                >
                    <Plus className="w-4 h-4" />
                    Добавить программу
                </Link>
            </div>

            {programs.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border rounded-lg">
                    <HeartPulse className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет программ психологии</p>
                    <Link 
                        href="/admin/psychology/new" 
                        className="text-blue-500 hover:underline mt-2 inline-block"
                    >
                        Создать первую программу
                    </Link>
                </div>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600 w-12">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                    </th>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600">Название</th>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600">Цена</th>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600">Длительность</th>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600">Статус</th>
                                    <th className="text-left p-3 text-sm font-medium text-gray-600">Действия</th>
                                </tr>
                            </thead>
                            <SortableContext
                                items={programs.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <tbody>
                                    {programs.map((program) => (
                                        <SortableProgramRow
                                            key={program.id}
                                            program={program}
                                            onDelete={handleDelete}
                                            onEdit={(id) => window.location.href = `/admin/psychology/${id}`}
                                            onView={(slug) => window.open(`/psychology/${slug}`, '_blank')}
                                        />
                                    ))}
                                </tbody>
                            </SortableContext>
                        </table>
                    </DndContext>
                </div>
            )}
        </div>
    );
}
