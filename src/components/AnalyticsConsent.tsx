"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Consent = "granted" | "denied" | null;
type YmFunction = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    ym?: YmFunction;
  }
}

const CONSENT_KEY = "body-state-analytics-consent-v1";
const SETTINGS_EVENT = "body-state:analytics-settings";
const METRIKA_ID = (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "113557210").trim();
const UMAMI_ID = (process.env.NEXT_PUBLIC_UMAMI_ID ?? "").trim();
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";

function installMetrica() {
  if (!/^\d+$/.test(METRIKA_ID)) return;

  const flags = window as unknown as Record<string, unknown>;
  flags[`disableYaCounter${METRIKA_ID}`] = false;

  if (!window.ym) {
    const stub: YmFunction = (...args: unknown[]) => {
      (stub.a ??= []).push(args);
    };
    stub.l = Date.now();
    window.ym = stub;
  }

  if (document.querySelector("script[data-body-state-metrica]")) return;

  window.ym(Number(METRIKA_ID), "init", {
    defer: true, // Pageviews are sent by the App Router pathname effect below.
    webvisor: false, // Do not record booking, checkout, or account content.
    clickmap: false,
    trackLinks: true,
    accurateTrackBounce: true,
    sendTitle: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
  script.dataset.bodyStateMetrica = "true";
  document.head.appendChild(script);
}

function installUmami() {
  if (!UMAMI_ID || document.querySelector("script[data-body-state-umami]")) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = UMAMI_SRC;
  script.dataset.websiteId = UMAMI_ID;
  script.dataset.domains = "body-state.ru";
  script.dataset.bodyStateUmami = "true";
  document.head.appendChild(script);
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastHit = useRef<string | null>(null);
  const hasAnalytics = /^\d+$/.test(METRIKA_ID) || Boolean(UMAMI_ID);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      setConsent(stored === "granted" || stored === "denied" ? stored : null);
    } catch {
      setConsent(null);
    }
    setReady(true);
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener(SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    installMetrica();
    installUmami();
  }, [consent]);

  useEffect(() => {
    if (consent !== "granted" || !/^\d+$/.test(METRIKA_ID)) {
      lastHit.current = null;
      return;
    }
    // Never include URL query parameters, fragments, e-mails or other PII.
    const safeUrl = `${window.location.origin}${pathname}`;
    if (lastHit.current === safeUrl) return;
    lastHit.current = safeUrl;
    window.ym?.(Number(METRIKA_ID), "hit", safeUrl);
  }, [consent, pathname]);

  function decide(next: Exclude<Consent, null>) {
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch {
      // If storage is blocked, choice applies for this page only.
    }
    if (consent === "granted" && next === "denied") {
      if (/^\d+$/.test(METRIKA_ID)) {
        (window as unknown as Record<string, unknown>)[`disableYaCounter${METRIKA_ID}`] = true;
      }
      // Reload to fully stop scripts already running, including Umami.
      window.location.reload();
      return;
    }
    setConsent(next);
    setSettingsOpen(false);
  }

  if (!ready || !hasAnalytics || (consent !== null && !settingsOpen)) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="Настройки аналитики сайта"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-2xl border p-5 shadow-2xl"
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <h2 className="mb-2 text-base font-semibold">Аналитика сайта</h2>
      <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-secondary)" }}>
        Мы используем инструменты аналитики для улучшения сайта. Они включаются
        только после вашего согласия. Вы можете отказать без ограничений доступа
        к услугам. Подробнее — в{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          политике обработки персональных данных
        </Link>.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => decide("granted")}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: "var(--primary)" }}
        >
          Разрешить аналитику
        </button>
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-full border px-5 py-2.5 text-sm font-semibold"
          style={{ borderColor: "var(--border)" }}
        >
          Отказаться
        </button>
      </div>
    </section>
  );
}

export function AnalyticsSettingsButton() {
  return (
    <button
      type="button"
      className="hover:underline"
      style={{ color: "var(--primary)" }}
      onClick={() => window.dispatchEvent(new Event(SETTINGS_EVENT))}
    >
      Настройки аналитики
    </button>
  );
}

/** Only emits an anonymous conversion goal after analytics consent. */
export function trackMetricaGoal(goal: string) {
  if (typeof window === "undefined" || !/^\d+$/.test(METRIKA_ID)) return;
  try {
    if (window.localStorage.getItem(CONSENT_KEY) !== "granted") return;
  } catch {
    return;
  }
  window.ym?.(Number(METRIKA_ID), "reachGoal", goal);
}
