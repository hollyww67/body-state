"use client";

import { useTheme } from "@/components/ThemeProvider";
import { toggleTheme } from "@/lib/theme";
import { MoonStar, Sun } from "lucide-react";

export default function AdminThemeToggle() {
  const dark = useTheme() === "chocolate-dark";

  const handleToggleTheme = () => {
    document.documentElement.classList.add("admin-theme-changing");
    toggleTheme();
    window.setTimeout(() => document.documentElement.classList.remove("admin-theme-changing"), 380);
  };

  return (
    <button
      type="button"
      onClick={handleToggleTheme}
      className="admin-theme-toggle"
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={dark}
      title={dark ? "Светлая" : "Тёмная"}
    >
      <span className="admin-theme-toggle-icon">
        {dark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </span>
      <span className="admin-theme-toggle-copy">
        <small>Тема</small>
        <strong>{dark ? "Тёмная" : "Светлая"}</strong>
      </span>
    </button>
  );
}
