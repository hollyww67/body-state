"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Palette, ShieldCheck } from "lucide-react";

const themes = [
  { value: "teal", label: "Teal", desc: "Светлая тема", gradient: "from-teal-500 to-emerald-600" },
  { value: "violet", label: "Violet", desc: "Тёмная тема", gradient: "from-violet-500 to-purple-600" },
  { value: "ironman", label: "Iron Man", desc: "Светлая Stark-tech", gradient: "from-red-600 to-amber-500" },
  { value: "newyear", label: "Новый год", desc: "Снежная тема", gradient: "from-blue-600 to-indigo-400" },
];

export default function AdminSettingsPage() {
  const [theme, setTheme] = useState("teal");
  const [saved, setSaved] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {
    fetch("/api/theme").then((r) => r.json()).then((data) => setTheme(data.theme || "teal")).catch(() => {});
  }, []);

  const saveTheme = async (newTheme: string) => {
    if (themeBusy) return;
    setThemeBusy(true); setThemeError(""); setSaved(false);
    try {
    const response = await fetch("/api/admin/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: newTheme }) });
    if (!response.ok) throw new Error();
    setTheme(newTheme); setSaved(true);
    document.documentElement.setAttribute("data-theme", newTheme);
    setTimeout(() => setSaved(false), 2000);
    } catch { setThemeError("Не удалось сохранить тему. Проверьте соединение и повторите выбор."); }
    finally { setThemeBusy(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordLoading(true); setPasswordMessage(""); setPasswordError(false);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось обновить пароль");
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setPasswordMessage(result.message || "Пароль обновлён");
    } catch (error) {
      setPasswordError(true);
      setPasswordMessage(error instanceof Error ? error.message : "Не удалось обновить пароль");
    } finally { setPasswordLoading(false); }
  };

  const cardStyle = { background: "var(--admin-panel)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow)" };
  const fieldClass = "h-12 w-full rounded-xl border px-4 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-[var(--admin-accent)]/25";

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-[10px] font-extrabold uppercase tracking-[.18em]" style={{ color: "var(--admin-accent)" }}>Управление</p><h2 className="mt-1 text-2xl font-semibold" style={{ color: "var(--admin-text)" }}>Настройки</h2><p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Оформление сайта и безопасность административного доступа.</p></header>

    <section className="rounded-[20px] border p-5 md:p-6" style={cardStyle}>
      <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent-strong)" }}><Palette className="h-5 w-5" /></span><div><h3 className="font-semibold" style={{ color: "var(--admin-text)" }}>Тема основного сайта</h3><p className="text-xs" style={{ color: "var(--admin-muted)" }}>Изменение применяется ко всем посетителям.</p></div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{themes.map((item) => <button key={item.value} onClick={() => saveTheme(item.value)} className="rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5" style={theme === item.value ? { borderColor: "var(--admin-accent)", background: "var(--admin-accent-soft)" } : { borderColor: "var(--admin-border)", background: "var(--admin-panel-soft)" }}><div className={`mb-3 h-8 w-8 rounded-full bg-gradient-to-br ${item.gradient}`} /><span className="text-sm font-semibold" style={{ color: "var(--admin-text)" }}>{item.label}</span><p className="mt-1 text-xs" style={{ color: "var(--admin-muted)" }}>{item.desc}</p></button>)}</div>
      {themeBusy && <p role="status" className="mt-4 text-sm">Сохраняем тему…</p>}
      {themeError && <p role="alert" className="mt-4 text-sm">{themeError}</p>}
      {saved && <p role="status" className="mt-4 text-sm" style={{ color: "var(--admin-accent-strong)" }}>Тема сохранена.</p>}
    </section>

    <section className="rounded-[20px] border p-5 md:p-6" style={cardStyle}>
      <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent-strong)" }}><KeyRound className="h-5 w-5" /></span><div><h3 className="font-semibold" style={{ color: "var(--admin-text)" }}>Пароль администратора</h3><p className="text-xs" style={{ color: "var(--admin-muted)" }}>После обновления все остальные админ-сеансы будут завершены.</p></div></div>
      <form onSubmit={changePassword} className="max-w-xl space-y-4">
        {[{ label: "Текущий пароль", value: currentPassword, setter: setCurrentPassword, autoComplete: "current-password" }, { label: "Новый пароль", value: newPassword, setter: setNewPassword, autoComplete: "new-password" }, { label: "Повторите новый пароль", value: confirmation, setter: setConfirmation, autoComplete: "new-password" }].map((field) => <label key={field.label} className="block"><span className="mb-2 block text-sm font-medium" style={{ color: "var(--admin-text)" }}>{field.label}</span><span className="relative block"><input type={showPasswords ? "text" : "password"} value={field.value} onChange={(event) => field.setter(event.target.value)} autoComplete={field.autoComplete} minLength={field.autoComplete === "new-password" ? 6 : 1} className={fieldClass} required /><button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? "Скрыть пароли" : "Показать пароли"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-muted)" }}>{showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>)}
        <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: "var(--admin-panel-soft)", color: "var(--admin-muted)" }}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--admin-accent)" }} /><span>Минимум 6 символов. Для рабочей админки всё равно лучше использовать уникальный пароль из букв, цифр и знаков.</span></div>
        {passwordMessage && <p role="status" className="rounded-xl p-3 text-sm" style={{ background: passwordError ? "rgba(220,38,38,.1)" : "var(--admin-accent-soft)", color: passwordError ? "#dc2626" : "var(--admin-accent-strong)" }}>{passwordMessage}</p>}
        <button type="submit" disabled={passwordLoading || !currentPassword || !newPassword || !confirmation} className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ background: "var(--admin-accent)" }}>{passwordLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Обновить пароль"}</button>
      </form>
    </section>
  </div>;
}
