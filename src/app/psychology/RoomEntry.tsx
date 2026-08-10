"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

export default function RoomEntry() {
  const [roomId, setRoomId] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    setChecking(true);
    setError("");
    const res = await fetch(`/api/room/check?id=${roomId.trim()}`);
    const data = await res.json();
    if (data.valid) {
      router.push(`/psychology/room?id=${roomId.trim()}`);
    } else {
      setError("Комната с таким ID не найдена.");
      setChecking(false);
    }
  };

  return (
    <div className="mb-10 p-6 rounded-3xl" style={{ background: 'var(--primary-muted)' }}>
      <div className="flex items-center gap-3 mb-4">
        <Video className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Уже записаны на онлайн-сессию?</h2>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>Введите ID комнаты из уведомления.</p>
      <form onSubmit={joinRoom} className="flex gap-3">
        <input required type="text" placeholder="ID комнаты" value={roomId} onChange={(e) => { setRoomId(e.target.value); setError(""); }} className="flex-1 h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
        <button type="submit" disabled={checking} className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-6 py-3 font-medium gap-2 disabled:opacity-50">
          <span className="relative z-10">{checking ? "Проверяем..." : "Войти"}</span>
        </button>
      </form>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}
