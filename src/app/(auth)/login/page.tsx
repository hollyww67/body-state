"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "password" | "pin" | "create-pin";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => { checkPinStatus(); }, []);

  const checkPinStatus = async () => {
    try {
      const res = await fetch("/api/admin/pin-status");
      const data = await res.json();
      if (data.canUsePin) setMode("pin");
    } catch {}
  };

  const switchMode = (newMode: AuthMode) => { setError(""); setPin(""); setNewPin(""); setConfirmPin(""); setMode(newMode); };

  const loginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (res.ok) {
        setPassword("");
        const pinRes = await fetch("/api/admin/pin-status"); const pinData = await pinRes.json();
        if (pinData.hasPin) router.push("/admin/dashboard");
        else switchMode("create-pin");
      } else setError(data.error || "Неверный логин или пароль");
    } catch { setError("Ошибка соединения"); } finally { setLoading(false); }
  };

  const loginWithPin = async (e: React.FormEvent) => {
    e.preventDefault(); if (loading || pin.length < 6) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/login-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (res.ok) router.push("/admin/dashboard");
      else setError(data.error || "Неверный PIN");
    } catch { setError("Ошибка соединения"); } finally { setLoading(false); }
  };

  const setPermanentPin = async (e: React.FormEvent) => {
    e.preventDefault(); if (loading || newPin.length < 6) return;
    if (newPin !== confirmPin) { setError("PIN-коды не совпадают"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/set-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: newPin }) });
      if (res.ok) router.push("/admin/dashboard");
      else setError("Ошибка установки PIN");
    } catch { setError("Ошибка соединения"); } finally { setLoading(false); }
  };

  const PinDots = ({ value, max = 6 }: { value: string; max?: number }) => (
    <div className="flex items-center justify-center gap-3 mb-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < value.length ? "border-[#0F766E] bg-[#0F766E]" : "border-gray-300"}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2] px-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        {mode === "password" && (
          <>
            <h1 className="text-xl font-semibold text-[#111827] mb-1 text-center">Вход в админку</h1>
            <p className="text-sm text-[#6B7280] mb-6 text-center">Введите логин и пароль</p>
            <form onSubmit={loginWithPassword} className="space-y-4">
              <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 rounded-2xl border px-4 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} autoFocus />
              <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 rounded-2xl border px-4 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-full bg-[#0F766E] text-white font-medium hover:bg-[#0d6b63] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Войти
              </button>
            </form>
            <button onClick={() => switchMode("pin")} className="w-full py-2 text-sm text-[#6B7280] hover:text-[#0F766E] mt-3 transition-colors text-center">Войти по PIN-коду</button>
          </>
        )}

        {mode === "pin" && (
          <>
            <h1 className="text-xl font-semibold text-[#111827] mb-1 text-center">Быстрый вход</h1>
            <p className="text-sm text-[#6B7280] mb-6 text-center">Введите PIN-код (6+ цифр)</p>
            <form onSubmit={loginWithPin} className="space-y-4">
              <PinDots value={pin} max={6} />
              <input type="password" inputMode="numeric" placeholder="●●●●●●" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="w-full h-14 rounded-2xl border px-4 text-center text-2xl font-bold tracking-[0.3em]" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} autoFocus />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading || pin.length < 6} className="w-full py-3 rounded-full bg-[#0F766E] text-white font-medium hover:bg-[#0d6b63] transition-colors disabled:opacity-50">
                {loading ? "Проверяем..." : "Войти по PIN"}
              </button>
            </form>
            <button onClick={() => switchMode("password")} className="w-full py-2 text-sm text-[#6B7280] hover:text-[#0F766E] mt-4 transition-colors flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Войти по паролю
            </button>
          </>
        )}

        {mode === "create-pin" && (
          <>
            <h1 className="text-xl font-semibold text-[#111827] mb-1 text-center">Придумайте PIN</h1>
            <p className="text-sm text-[#6B7280] mb-6 text-center">Для быстрого входа (6+ цифр)</p>
            <form onSubmit={setPermanentPin} className="space-y-4">
              <PinDots value={newPin} max={6} />
              <input type="password" inputMode="numeric" placeholder="PIN (6+ цифр)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="w-full h-14 rounded-2xl border px-4 text-center text-2xl font-bold tracking-[0.3em]" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} autoFocus />
              <input type="password" inputMode="numeric" placeholder="Подтвердите PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="w-full h-12 rounded-2xl border px-4 text-center text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading || newPin.length < 6 || newPin !== confirmPin} className="w-full py-3 rounded-full bg-[#0F766E] text-white font-medium hover:bg-[#0d6b63] transition-colors disabled:opacity-50">
                Установить PIN
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
