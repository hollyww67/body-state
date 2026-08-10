'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Video, Copy, CheckCircle, Trash2, Plus, 
    Calendar, User, ExternalLink, Clock 
} from 'lucide-react';

interface Room {
    id: number;
    room_id: string;
    room_name: string;
    created_by: string;
    meeting_url: string;
    is_active: boolean;
    created_at: string;
    expires_at: string;
}

export default function PsychologyRoomsAdmin() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [newCreatedBy, setNewCreatedBy] = useState('');

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await fetch('/api/psychology/rooms');
            const data = await res.json();
            setRooms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            setRooms([]);
        } finally {
            setLoading(false);
        }
    };

    const createRoom = async () => {
        if (!newRoomName.trim()) {
            alert('Введите название комнаты');
            return;
        }

        setCreating(true);
        try {
            const res = await fetch('/api/psychology/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_name: newRoomName,
                    created_by: newCreatedBy || 'Психолог'
                })
            });

            if (res.ok) {
                setNewRoomName('');
                setNewCreatedBy('');
                await fetchRooms();
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка создания комнаты');
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Ошибка создания комнаты');
        } finally {
            setCreating(false);
        }
    };

    const deleteRoom = async (id: number) => {
        if (!confirm('Удалить комнату?')) return;

        try {
            const res = await fetch(`/api/psychology/rooms/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchRooms();
            } else {
                alert('Ошибка удаления');
            }
        } catch (error) {
            console.error('Error deleting room:', error);
        }
    };

    const copyLink = (url: string, id: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 3000);
    };

    const isExpired = (expiresAt: string) => {
        return new Date(expiresAt) < new Date();
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse">Загрузка комнат...</div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Video className="w-6 h-6 text-teal-500" />
                        Онлайн-комнаты психолога
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Создавайте комнаты для видеоконсультаций. Ссылка действует 24 часа.
                    </p>
                </div>
            </div>

            {/* Форма создания */}
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
                <h2 className="font-semibold mb-4">Создать новую комнату</h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Название комнаты (например: Консультация Ивановой)"
                        className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <input
                        type="text"
                        value={newCreatedBy}
                        onChange={(e) => setNewCreatedBy(e.target.value)}
                        placeholder="Кто создаёт (по умолчанию: Психолог)"
                        className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                        onClick={createRoom}
                        disabled={creating}
                        className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" />
                        {creating ? 'Создание...' : 'Создать комнату'}
                    </button>
                </div>
            </div>

            {/* Список комнат */}
            <div className="space-y-4">
                {rooms.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border rounded-2xl">
                        <Video className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Нет созданных комнат</p>
                        <p className="text-sm">Создайте первую комнату для онлайн-консультации</p>
                    </div>
                ) : (
                    rooms.map((room) => {
                        const expired = isExpired(room.expires_at);
                        return (
                            <motion.div
                                key={room.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-all ${
                                    expired ? 'opacity-70' : ''
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg">{room.room_name}</h3>
                                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <User className="w-4 h-4" />
                                                {room.created_by}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(room.created_at).toLocaleString('ru-RU')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {expired ? 'Истекла' : `Действует до ${new Date(room.expires_at).toLocaleString('ru-RU')}`}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs">
                                                <ExternalLink className="w-4 h-4" />
                                                <a href={room.meeting_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline truncate max-w-xs">
                                                    {room.meeting_url}
                                                </a>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => copyLink(room.meeting_url, room.room_id)}
                                            className="px-4 py-2 border rounded-xl hover:bg-gray-50 transition flex items-center gap-2"
                                        >
                                            {copiedId === room.room_id ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                            {copiedId === room.room_id ? 'Скопировано' : 'Скопировать'}
                                        </button>

                                        <a
                                            href={room.meeting_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`px-4 py-2 text-white rounded-xl transition flex items-center gap-2 ${
                                                expired 
                                                    ? 'bg-gray-400 cursor-not-allowed' 
                                                    : 'bg-teal-500 hover:bg-teal-600'
                                            }`}
                                            onClick={(e) => expired && e.preventDefault()}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Войти
                                        </a>

                                        <button
                                            onClick={() => deleteRoom(room.id)}
                                            className="p-2 border rounded-xl hover:bg-red-50 hover:border-red-200 transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>

                                {expired && (
                                    <div className="mt-3 text-xs text-orange-500 flex items-center gap-1">
                                        ⚠️ Срок действия ссылки истёк
                                    </div>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
