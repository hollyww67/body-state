"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Неверный логин или пароль");
      setPassword("");
      router.replace("/admin/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <section className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_24px_70px_var(--shadow-color)]">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--shadow-color)]"><Sparkles className="h-6 w-6" /></div>
        <h1 className="text-center text-2xl font-semibold text-[var(--foreground)]">Вход в админку</h1>
        <p className="mb-7 mt-2 text-center text-sm leading-6 text-[var(--foreground-secondary)]">Доступ только по основному паролю администратора</p>
        <form onSubmit={login} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--foreground)]">Логин<input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--foreground)] px-4 outline-none focus:border-[var(--focus)] focus:ring-4 focus:ring-[var(--focus-soft)]" /></label>
          <label className="block text-sm font-medium text-[var(--foreground)]">Пароль<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--foreground)] px-4 outline-none focus:border-[var(--focus)] focus:ring-4 focus:ring-[var(--focus-soft)]" /></label>
          {error && <p role="alert" className="rounded-xl bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
          <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Проверяем…" : "Войти"}</button>
        </form>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--foreground-secondary)]"><ShieldCheck className="h-4 w-4 text-[var(--primary)]" />Сессия хранится в защищённой HttpOnly-cookie</p>
      </section>
    </main>
  );
}
