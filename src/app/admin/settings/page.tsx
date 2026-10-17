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
  const [shopVisible, setShopVisible] = useState(false);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState("");
  const [shopMessage, setShopMessage] = useState("");

  useEffect(() => {
    fetch("/api/theme").then((r) => r.json()).then((data) => setTheme(data.theme || "teal")).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/site-visibility", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить настройку магазина");
        return response.json();
      })
      .then((data) => setShopVisible(data.shopVisible === true))
      .catch((error) => setShopError(error instanceof Error ? error.message : "Ошибка загрузки"))
      .finally(() => setShopLoading(false));
  }, []);

  const toggleShop = async () => {
    if (shopSaving || shopLoading) return;
    const next = !shopVisible;
    setShopSaving(true);
    setShopError("");
    setShopMessage("");
    try {
      const response = await fetch("/api/admin/site-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopVisible: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка сохранения");
      setShopVisible(data.shopVisible === true);
      setShopMessage(next ? "Страница магазина доступна посетителям." : "Магазин скрыт, покупки товаров отключены.");
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Не удалось обновить настройку");
    } finally {
      setShopSaving(false);
    }
  };

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
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h3 className="text-base font-semibold" style={{ color: "var(--admin-text)" }}>Показывать страницу магазина</h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--admin-muted)" }}>
            Когда выключено, магазин и корзина скрыты, а покупка товаров недоступна. Каталог и заказы сохраняются в админке. Оплата процедур работает независимо.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-label="Показывать страницу магазина"
          aria-checked={shopVisible}
          disabled={shopLoading || shopSaving}
          onClick={toggleShop}
          className="inline-flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-text)" }}
        >
          <span className={"relative h-6 w-11 rounded-full transition-colors " + (shopVisible ? "bg-emerald-600" : "bg-slate-400")}>
            <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform " + (shopVisible ? "translate-x-[22px]" : "translate-x-0.5")} />
          </span>
          {shopLoading ? "Загрузка…" : shopSaving ? "Сохранение…" : shopVisible ? "Включён" : "Выключен"}
        </button>
      </div>
      {shopError && <div className="mt-4"><AdminFeedback tone="destructive">{shopError}</AdminFeedback></div>}
      {shopMessage && <div className="mt-4"><AdminFeedback tone="success">{shopMessage}</AdminFeedback></div>}
    </AdminCard>

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
