"use client";

import { useEffect, useState } from "react";

export default function ShopVisibilityControl() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-visibility", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить видимость магазина");
        return response.json();
      })
      .then((data) => setEnabled(data.shopVisible === true))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    if (loading || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/site-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopVisible: !enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка сохранения");
      setEnabled(data.shopVisible === true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        role="switch"
        aria-label="Показывать страницу магазина на сайте"
        aria-checked={enabled}
        disabled={loading || saving}
        onClick={toggle}
        className="flex items-center gap-2 text-xs font-semibold disabled:opacity-60"
        style={{ color: "var(--bs-foreground)" }}
      >
        <span className={"relative inline-block h-5 w-9 rounded-full transition-colors " + (enabled ? "bg-emerald-600" : "bg-slate-400")}>
          <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform " + (enabled ? "translate-x-[18px]" : "translate-x-0.5")} />
        </span>
        {loading ? "Загрузка…" : saving ? "Сохранение…" : enabled ? "Виден на сайте" : "Скрыт с сайта"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
