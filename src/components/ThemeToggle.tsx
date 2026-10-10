"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>("teal");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      fetch("/api/theme")
        .then((r) => r.json())
        .then((data) => {
          const t = data.theme || "teal";
          setTheme(t);
          document.documentElement.setAttribute("data-theme", t);
        })
        .catch(() => {});
    }
  }, []);

  const toggle = () => {
    const next = theme === "teal" ? "violet" : "teal";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next === "violet" ? "dark" : "light";
  };

  return (
    <button
      onClick={toggle}
      type="button"
      className="theme-toggle grid h-10 w-10 place-items-center rounded-2xl border transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--glass-bg)', color: 'var(--foreground)', borderColor: 'var(--glass-border)' }}
      title={theme === "teal" ? "Тёмная тема" : "Светлая тема"}
      aria-label={theme === "teal" ? "Включить тёмную violet-тему" : "Включить светлую тему"}
    >
      {theme === "teal" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
    </button>
  );
}
