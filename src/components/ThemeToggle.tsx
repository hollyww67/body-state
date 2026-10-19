"use client";

import { useTheme } from "@/components/ThemeProvider";
import { toggleTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const dark = useTheme() === "chocolate-dark";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="theme-toggle grid h-10 w-10 place-items-center rounded-2xl border transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--glass-bg)', color: 'var(--foreground)', borderColor: 'var(--glass-border)' }}
      title={dark ? "Светлая" : "Тёмная"}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={dark}
    >
      {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}
