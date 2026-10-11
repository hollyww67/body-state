"use client";

import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";

type AdminTheme = "light" | "violet";

const STORAGE_KEY = "admin-theme";

function applyTheme(theme: AdminTheme) {
  document.documentElement.setAttribute("data-admin-theme", theme);
}

export default function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: AdminTheme = saved === "violet" ? "violet" : "light";
    setTheme(initial);
    applyTheme(initial);

    const syncTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next: AdminTheme = event.newValue === "violet" ? "violet" : "light";
      setTheme(next);
      applyTheme(next);
    };

    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      document.documentElement.removeAttribute("data-admin-theme");
    };
  }, []);

  const toggleTheme = () => {
    const next: AdminTheme = theme === "light" ? "violet" : "light";
    document.documentElement.classList.add("admin-theme-changing");
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.setTimeout(() => document.documentElement.classList.remove("admin-theme-changing"), 380);
  };

  const violet = theme === "violet";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="admin-theme-toggle"
      aria-label={violet ? "Включить светлую тему" : "Включить тёмную violet-тему"}
      aria-pressed={violet}
      title={violet ? "Светлая тема" : "Violet-тема"}
    >
      <span className="admin-theme-toggle-icon">
        {violet ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </span>
      <span className="admin-theme-toggle-copy">
        <small>Тема</small>
        <strong>{violet ? "Violet" : "Светлая"}</strong>
      </span>
    </button>
  );
}
