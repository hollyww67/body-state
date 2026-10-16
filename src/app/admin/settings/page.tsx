"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Palette, ShieldCheck } from "lucide-react";
import {AdminButton,AdminCard,AdminFeedback,AdminInput,AdminPageHeader} from '@/components/admin/ui';

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

  return <div className="mx-auto max-w-4xl space-y-6">
    <AdminPageHeader title="Настройки" description="Оформление сайта и безопасность административного доступа." />

    <AdminCard>
      <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent-strong)" }}><Palette className="h-5 w-5" /></span><div><h3 className="font-semibold" style={{ color: "var(--admin-text)" }}>Тема основного сайта</h3><p className="text-xs" style={{ color: "var(--admin-muted)" }}>Изменение применяется ко всем посетителям.</p></div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{themes.map(item=><AdminButton key={item.value} variant="outline" className="bs-theme-choice" aria-pressed={theme===item.value} onClick={()=>saveTheme(item.value)}><div className={`h-8 w-8 rounded-full bg-gradient-to-br ${item.gradient}`} aria-hidden="true"/><span>{item.label}</span><p>{item.desc}</p></AdminButton>)}</div>
      {themeBusy && <p role="status" className="mt-4 text-sm">Сохраняем тему…</p>}
      {themeError && <AdminFeedback tone="destructive">{themeError}</AdminFeedback>}
      {saved && <AdminFeedback tone="success">Тема сохранена.</AdminFeedback>}
    </AdminCard>

    <AdminCard>
      <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent-strong)" }}><KeyRound className="h-5 w-5" /></span><div><h3 className="font-semibold" style={{ color: "var(--admin-text)" }}>Пароль администратора</h3><p className="text-xs" style={{ color: "var(--admin-muted)" }}>После обновления все остальные админ-сеансы будут завершены.</p></div></div>
      <form onSubmit={changePassword} className="max-w-xl space-y-4">
        {[{label:'Текущий пароль',value:currentPassword,setter:setCurrentPassword,autoComplete:'current-password'},{label:'Новый пароль',value:newPassword,setter:setNewPassword,autoComplete:'new-password'},{label:'Повторите новый пароль',value:confirmation,setter:setConfirmation,autoComplete:'new-password'}].map(field=><div key={field.label}><label className="mb-2 block text-sm" htmlFor={field.autoComplete==='current-password'?'current-admin-password':field.label==='Новый пароль'?'new-admin-password':'confirm-admin-password'}>{field.label}</label><div className="relative"><AdminInput id={field.autoComplete==='current-password'?'current-admin-password':field.label==='Новый пароль'?'new-admin-password':'confirm-admin-password'} type={showPasswords?'text':'password'} value={field.value} onChange={event=>field.setter(event.target.value)} autoComplete={field.autoComplete} minLength={field.autoComplete==='new-password'?6:1} className="pr-14" required/><AdminButton variant="ghost" size="icon" onClick={()=>setShowPasswords(value=>!value)} aria-label={`${showPasswords?'Скрыть':'Показать'}: ${field.label}`} className="bs-password-reveal">{showPasswords?<EyeOff size={16}/>:<Eye size={16}/>}</AdminButton></div></div>)}
        <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: "var(--admin-panel-soft)", color: "var(--admin-muted)" }}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--admin-accent)" }} /><span>Минимум 6 символов. Для рабочей админки всё равно лучше использовать уникальный пароль из букв, цифр и знаков.</span></div>
        {passwordMessage && <AdminFeedback tone={passwordError?'destructive':'success'}>{passwordMessage}</AdminFeedback>}
        <AdminButton type="submit" disabled={passwordLoading || !currentPassword || !newPassword || !confirmation} loading={passwordLoading}>Обновить пароль</AdminButton>
      </form>
    </AdminCard>
  </div>;
}
