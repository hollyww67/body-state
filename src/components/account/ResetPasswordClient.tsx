"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import TextField from "@/components/ui/TextField";

export default function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, password_confirmation: confirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось обновить пароль");
      setSuccess(true);
      setMessage(result.message || "Пароль обновлён");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-lg">
      <div className="ds-panel ds-auth-card">
        <div className="ds-auth-icon">{success ? <CheckCircle2 /> : <KeyRound />}</div>
        <span className="ds-kicker">Безопасность аккаунта</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em]">{success ? "Пароль обновлён" : "Новый пароль"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">{success ? "Все прежние сессии завершены. Войдите в кабинет с новым паролем." : "Придумайте новый пароль. Ссылка работает один раз и действует 30 минут."}</p>

        {!validToken ? (
          <div className="mt-6"><p className="ds-alert is-error">Ссылка восстановления повреждена или неполна.</p><Link href="/account" className="ds-secondary-button mt-4 w-full"><ArrowLeft /> Вернуться ко входу</Link></div>
        ) : success ? (
          <Link href="/account" className="ds-primary-button mt-6 w-full">Войти в личный кабинет</Link>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <TextField label="Новый пароль" icon={<KeyRound />} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} hint="Не менее 10 символов, минимум одна буква и одна цифра" required />
            <TextField label="Повторите пароль" icon={<ShieldCheck />} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={10} error={confirmation && password !== confirmation ? "Пароли не совпадают" : undefined} required />
            {message && <p role="alert" className="ds-alert is-error">{message}</p>}
            <button type="submit" disabled={loading || password !== confirmation} className="ds-primary-button w-full">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Сохранить новый пароль"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
