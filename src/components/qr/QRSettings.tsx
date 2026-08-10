"use client";

import { useEffect } from "react";

const COLORS = [
  { label: "Teal", value: "#0F766E" },
  { label: "Красный", value: "#C1122F" },
  { label: "Золотой", value: "#D4AF37" },
  { label: "Синий", value: "#1E40AF" },
  { label: "Чёрный", value: "#111827" },
];

interface Props {
  color: string;
  setColor: (c: string) => void;
  withLogo: boolean;
  setWithLogo: (v: boolean) => void;
}

export default function QRSettings({ color, setColor, withLogo, setWithLogo }: Props) {
  // Сохраняем настройки
  useEffect(() => {
    localStorage.setItem("qr-color", color);
    localStorage.setItem("qr-logo", String(withLogo));
  }, [color, withLogo]);

  // Восстанавливаем при монтировании
  useEffect(() => {
    const savedColor = localStorage.getItem("qr-color");
    const savedLogo = localStorage.getItem("qr-logo");
    if (savedColor) setColor(savedColor);
    if (savedLogo) setWithLogo(savedLogo === "true");
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>Цвет:</span>
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c.value ? "border-gray-800 scale-110" : "border-gray-200"}`}
            style={{ backgroundColor: c.value }}
            title={c.label}
            aria-label={`Цвет ${c.label}`}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
          title="Свой цвет"
          aria-label="Выбрать свой цвет"
        />
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--foreground-secondary)' }}>
        <input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} className="rounded" />
        С логотипом
      </label>
    </div>
  );
}
