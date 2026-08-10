'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Loader2, Video, Users, Shield } from 'lucide-react';
import Link from 'next/link';

export default function PsychologyRoomPage() {
    const params = useParams();
    const id = params.id as string;
    const [loading, setLoading] = useState(true);
    const [room, setRoom] = useState<{ 
        room_name: string; 
        meeting_url: string;
        is_active: boolean;
        expires_at: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        fetch(`/api/psychology/rooms/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Комната не найдена');
                return res.json();
            })
            .then(data => {
                setRoom(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                    <p className="text-gray-500">Загрузка комнаты...</p>
                </div>
            </main>
        );
    }

    if (error || !room) {
        return (
            <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
                <Navbar />
                <div className="pt-32 px-4 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Video className="w-8 h-8 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                            Комната не найдена
                        </h1>
                        <p className="text-gray-500 mb-6">
                            Ссылка могла быть удалена или истекла.
                        </p>
                        <Link 
                            href="/psychology" 
                            className="px-6 py-3 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition"
                        >
                            Вернуться к программам
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const isExpired = new Date(room.expires_at) < new Date();

    if (isExpired || !room.is_active) {
        return (
            <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
                <Navbar />
                <div className="pt-32 px-4 text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-8 h-8 text-orange-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                            Срок действия истёк
                        </h1>
                        <p className="text-gray-500 mb-6">
                            Комната была создана более 24 часов назад.
                        </p>
                        <Link 
                            href="/psychology" 
                            className="px-6 py-3 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition"
                        >
                            Вернуться к программам
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
            <Navbar />
            <div className="pt-20 px-4 pb-4 h-screen">
                <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                            {room.room_name}
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Users className="w-4 h-4" />
                            <span>Подключение через Jitsi</span>
                        </div>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                        <iframe
                            src={room.meeting_url}
                            className="w-full h-full"
                            allow="camera; microphone; fullscreen; display-capture"
                            allowFullScreen
                            style={{ background: 'var(--bg)' }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        🔒 Видеоконсультация защищена. Доступ только у участников с ссылкой.
                    </p>
                </div>
            </div>
        </main>
    );
}
