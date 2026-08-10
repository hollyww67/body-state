"use client";
import { useEffect, useState } from "react";

const themes = [
  { value: "teal", label: "Teal", desc: "Светлая тема", gradient: "from-teal-500 to-emerald-600" },
  { value: "violet", label: "Violet", desc: "Тёмная тема", gradient: "from-violet-500 to-purple-600" },
  { value: "ironman", label: "Iron Man", desc: "Светлая Stark-tech", gradient: "from-red-600 to-amber-500" },
  { value: "newyear", label: "Новый год", desc: "Снежная тема", gradient: "from-blue-600 to-indigo-400" },
];

export default function AdminSettingsPage() {
  const [theme, setTheme] = useState("teal");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/theme").then((r) => r.json()).then((data) => setTheme(data.theme || "teal")).catch(() => {});
  }, []);

  const saveTheme = async (newTheme: string) => {
    await fetch("/api/admin/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: newTheme }) });
    setTheme(newTheme);
    setSaved(true);
    document.documentElement.setAttribute("data-theme", newTheme);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold text-[#111827] mb-8">Настройки темы</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => saveTheme(t.value)}
            className={`p-6 rounded-2xl border-2 transition-all text-left ${
              theme === t.value ? "border-[#0F766E] bg-[#D9F3EF]/50" : "border-gray-100 bg-white hover:border-gray-200"
            }`}
          >
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${t.gradient} mb-3`} />
            <span className="font-semibold text-[#111827] text-sm">{t.label}</span>
            <p className="text-xs text-[#6B7280] mt-1">{t.desc}</p>
          </button>
        ))}
      </div>
      {saved && <p className="mt-4 text-sm text-green-600">Тема сохранена. Обновите сайт.</p>}
    </div>
  );
}
