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
  };

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
      style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}
      title={theme === "teal" ? "Тёмная тема" : "Светлая тема"}
    >
      {theme === "teal" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
