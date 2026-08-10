'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function ProgramEnrollmentForm() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Простая валидация
        if (!name.trim() || !phone.trim()) {
            setError('Имя и телефон обязательны для заполнения');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/program-enroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_name: name, client_phone: phone, notes: message }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Ошибка при отправке');
            }

            setSuccess(true);
            setName('');
            setPhone('');
            setMessage('');
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Ошибка при отправке');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 border border-red-100"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100"
                    >
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">Заявка отправлена! Мы свяжемся с вами.</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                    Имя <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    style={{
                        background: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                    }}
                    placeholder="Ваше имя"
                    disabled={loading || success}
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                    Телефон <span className="text-red-400">*</span>
                </label>
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    style={{
                        background: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                    }}
                    placeholder="+7 (___)-___-__-__"
                    disabled={loading || success}
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-secondary)' }}>
                    Сообщение
                </label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    style={{
                        background: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                    }}
                    placeholder="Дополнительная информация..."
                    disabled={loading || success}
                />
            </div>

            <button
                type="submit"
                disabled={loading || success}
                className="w-full py-4 px-6 rounded-2xl font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 82%, white))' }}
            >
                {loading ? (
                    <>Отправка...</>
                ) : success ? (
                    <>Отправлено!</>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        Отправить заявку
                    </>
                )}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--foreground-secondary)' }}>
                Нажимая на кнопку, вы соглашаетесь с обработкой персональных данных
            </p>
        </form>
    );
}
