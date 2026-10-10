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
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f5] px-4">
      <section className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(24,53,47,.10)]">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20"><Sparkles className="h-6 w-6" /></div>
        <h1 className="text-center text-2xl font-semibold text-slate-900">Вход в админку</h1>
        <p className="mb-7 mt-2 text-center text-sm leading-6 text-slate-500">Доступ только по основному паролю администратора</p>
        <form onSubmit={login} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Логин<input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" /></label>
          <label className="block text-sm font-medium text-slate-700">Пароль<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" /></label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0F766E] font-semibold text-white transition hover:bg-[#0d655d] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Проверяем…" : "Войти"}</button>
        </form>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-teal-600" />Сессия хранится в защищённой HttpOnly-cookie</p>
      </section>
    </main>
  );
}
