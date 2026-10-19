'use client';

import { useEffect, useId, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import PersonalDataConsent from '@/components/legal/PersonalDataConsent';
import TextField from '@/components/ui/TextField';
import { TextareaField } from '@/components/ui/ChoiceField';
import { Button } from '@/components/ui/button';
import { formatRussianPhoneInput } from '@/lib/phone';
import { useAccountPrefill } from '@/lib/hooks/use-account-prefill';

export default function ProgramEnrollmentForm() {
    const profile = useAccountPrefill();
    const fieldId = useId();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consent, setConsent] = useState(false);

    useEffect(() => {
        if (!profile) return;
        setName((value) => value || profile.display_name || '');
        setPhone((value) => value || (profile.phone ? formatRussianPhoneInput(profile.phone) : ''));
    }, [profile]);

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
            const res = await fetch('/api/program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_name: name, client_phone: phone, notes: message, consent }),
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
                {error && (
                    <div
                        role="alert"
                        className="flex items-center gap-3 rounded-2xl border border-[var(--qp-danger)] bg-[var(--qp-danger-bg)] p-4 text-[var(--qp-danger)]"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}
                {success && (
                    <div
                        role="status"
                        className="flex items-center gap-3 rounded-2xl border border-[var(--qp-success)] bg-[var(--qp-success-bg)] p-4 text-[var(--qp-success)]"
                    >
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium">Заявка отправлена! Мы свяжемся с вами.</span>
                    </div>
                )}
                <TextField
                    id={`${fieldId}-name`}
                    label="Имя"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                    disabled={loading || success}
                    required
                />
                <TextField
                    id={`${fieldId}-phone`}
                    label="Телефон"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
                    placeholder="+7 (___)-___-__-__"
                    disabled={loading || success}
                    required
                />
                <TextareaField
                    id={`${fieldId}-message`}
                    label="Сообщение (необязательно)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Дополнительная информация..."
                    disabled={loading || success}
                />
            <Button
                type="submit"
                disabled={loading || success || !consent}
                className="w-full whitespace-normal hover:translate-y-0"
                aria-busy={loading}
            >
                {loading ? (
                    <>Отправка...</>
                ) : success ? (
                    <>Отправлено!</>
                ) : (
                    <>
                        Отправить заявку
                    </>
                )}
            </Button>

            <PersonalDataConsent id="program-consent" checked={consent} onChange={setConsent} />
        </form>
    );
}
