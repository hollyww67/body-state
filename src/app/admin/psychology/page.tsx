'use client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { AdminBadge, AdminButton, AdminFeedback } from '@/components/admin/ui';

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
            className={`border-b border-[var(--bs-border)] hover:bg-[var(--bs-surface-muted)] transition ${isDragging ? 'shadow-lg' : ''}`}
        >
            <td className="p-3">
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="cursor-grab hover:cursor-grabbing inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--bs-radius-control)] hover:bg-[var(--bs-surface-muted)] transition"
                    aria-label={`Переместить ${program.title}`}
                >
                    <GripVertical className="w-4 h-4 text-[var(--bs-muted)]" />
                </div>
            </td>
            <td className="p-3 font-medium">{program.title}</td>
            <td className="p-3">{program.price}</td>
            <td className="p-3">{program.duration}</td>
            <td className="p-3">
                <AdminBadge tone={program.is_active ? 'success' : 'neutral'}>
                    {program.is_active ? 'Активна' : 'Черновик'}
                </AdminBadge>
            </td>
            <td className="p-3">
                <div className="flex gap-2">
                    <AdminButton type="button" variant="ghost" size="icon" aria-label="Редактировать"
                        onClick={() => onEdit(program.id)}
                        title="Редактировать"
                    >
                        <Edit className="w-4 h-4" />
                    </AdminButton>
                    <AdminButton type="button" variant="ghost" size="icon" aria-label="Просмотреть"
                        onClick={() => onView(program.slug)}
                        title="Просмотреть"
                    >
                        <Eye className="w-4 h-4" />
                    </AdminButton>
                    <AdminButton type="button" variant="destructive" size="icon" aria-label="Удалить"
                        onClick={() => onDelete(program.id, program.title)}
                        title="Удалить"
                    >
                        <Trash2 className="w-4 h-4" />
                    </AdminButton>
                </div>
            </td>
        </tr>
    );
}

export default function PsychologyAdmin() {
    const router = useRouter();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
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

    const handleDelete = async (id: number) => {

        try {
            const res = await fetch(`/api/admin/psychology/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Ошибка удаления');

            setPrograms(programs.filter(p => p.id !== id));
        } catch {
            toast.error('Не удалось удалить программу');
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
                toast.error('Не удалось сохранить порядок. Обновите страницу.');
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
                <AdminFeedback tone="destructive">Ошибка: {error}</AdminFeedback>
                <AdminButton type="button"
                    onClick={fetchPrograms} 
                    className="mt-4"
                >
                    Повторить
                </AdminButton>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 text-[var(--bs-foreground)]">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Программы психологии</h1>
                    <p className="text-sm text-[var(--bs-muted)] mt-1">
                        Всего программ: {programs.length}
                        {isReordering && ' (сохранение порядка...)'}
                    </p>
                </div>
                <Link
                    href="/admin/psychology/new"
                    className="bs-button bs-button--primary bs-button--md"
                >
                    <Plus className="w-4 h-4" />
                    Добавить программу
                </Link>
            </div>

            {programs.length === 0 ? (
                <div className="bs-card text-center py-12 text-[var(--bs-muted)]">
                    <HeartPulse className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет программ психологии</p>
                    <Link 
                        href="/admin/psychology/new" 
                        className="bs-button bs-button--ghost bs-button--md mt-2"
                    >
                        Создать первую программу
                    </Link>
                </div>
            ) : (
                <div className="bs-card overflow-x-auto" role="region" aria-label="Программы психологии" tabIndex={0}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <table className="bs-table w-full">
                            <thead className="bg-[var(--bs-surface-muted)] border-b border-[var(--bs-border)]">
                                <tr>
                                    <th scope="col" aria-label="Порядок" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)] w-12">
                                        <GripVertical className="w-4 h-4" />
                                    </th>
                                    <th scope="col" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)]">Название</th>
                                    <th scope="col" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)]">Цена</th>
                                    <th scope="col" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)]">Длительность</th>
                                    <th scope="col" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)]">Статус</th>
                                    <th scope="col" className="text-left p-3 text-sm font-medium text-[var(--bs-muted)]">Действия</th>
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
                                            onDelete={(id, title) => setDeleteTarget({ id, title })}
                                            onEdit={(id) => router.push(`/admin/psychology/${id}`)}
                                            onView={(slug) => window.open(`/psychology/${slug}`, '_blank')}
                                        />
                                    ))}
                                </tbody>
                            </SortableContext>
                        </table>
                    </DndContext>
                </div>
            )}
            {deleteTarget && <AdminConfirmDialog title={`Удалить программу "${deleteTarget.title}"?`} onCancel={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget.id)}><p>{deleteTarget.title}</p></AdminConfirmDialog>}
        </div>
    );
}
