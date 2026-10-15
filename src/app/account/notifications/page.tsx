"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";

type Settings = {
  email: string | null;
  emailEnabled: boolean;
  maxEnabled: boolean;
  maxConnected: boolean;
  reminders24h: boolean;
  reminders2h: boolean;
};
type Pairing = { code: string; expiresAt: string; botUrl: string };
const endpoint = "/api/account/notifications";

function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") throw new Error("Не удалось прочитать настройки.");
  const data = value as Record<string, unknown>;
  if (!(data.email === null || typeof data.email === "string") ||
    !["emailEnabled", "maxEnabled", "maxConnected", "reminders24h", "reminders2h"].every(key => typeof data[key] === "boolean")) {
    throw new Error("Не удалось прочитать настройки.");
  }
  return data as Settings;
}

async function request(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (response.status === 401) throw new Error("Войдите в личный кабинет, чтобы управлять уведомлениями.");
  if (!response.ok) throw new Error(response.status === 429
    ? "Слишком много запросов. Попробуйте немного позже."
    : "Не удалось выполнить запрос. Попробуйте ещё раз.");
  return response.status === 204 ? null : response.json();
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState({ reminders24h: false, reminders2h: false });
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  function accept(data: Settings) {
    setSettings(data);
    setDraft({ reminders24h: data.reminders24h, reminders2h: data.reminders2h });
    if (data.maxConnected || !data.maxEnabled) setPairing(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    void request(endpoint, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) accept(parseSettings(value));
    }).catch(() => {
      if (!controller.signal.aborted) setError("Не удалось загрузить настройки. Проверьте вход в кабинет и повторите попытку.");
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!pairing) return;
    const update = () => setExpired(Date.now() >= Date.parse(pairing.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  async function act(action: "refresh" | "save" | "pair" | "unlink") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "pair") {
        const result = await request(`${endpoint}/max/pair`, { method: "POST" });
        if (!result || typeof result !== "object") throw new Error("Не удалось получить код подключения.");
        const value = result as Record<string, unknown>;
        if (typeof value.code !== "string" || !value.code || typeof value.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now() || typeof value.botUrl !== "string") {
          throw new Error("Не удалось получить действующий код подключения.");
        }
        const url = new URL(value.botUrl);
        if (url.protocol !== "https:" || url.hostname !== "max.ru" || url.username || url.password || url.port) {
          throw new Error("Ссылка на официального бота MAX недоступна.");
        }
        setExpired(false);
        setPairing({ code: value.code, expiresAt: value.expiresAt, botUrl: url.href });
        setMessage("Код создан. Для подключения начните диалог с ботом MAX.");
      } else {
        if (action === "save") {
          await request(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        }
        if (action === "unlink") {
          await request(`${endpoint}/max/pair`, { method: "DELETE" });
          setPairing(null);
        }
        const data = parseSettings(await request(endpoint));
        accept(data);
        setMessage(action === "save" ? "Настройки сохранены." : action === "unlink"
          ? (data.maxConnected ? "MAX пока подключён. Проверьте статус повторно." : "MAX отключён.")
          : data.maxConnected ? "MAX подключён." : "Статус обновлён. MAX пока не подключён.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить запрос.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const canRemind = Boolean(settings && ((settings.emailEnabled && settings.email) || (settings.maxEnabled && settings.maxConnected)));
  const changed = settings && (draft.reminders24h !== settings.reminders24h || draft.reminders2h !== settings.reminders2h);

  return <><Navbar /><main className="min-h-screen pb-20 pt-28" style={{ background: "var(--bg)" }}>
    <Container><div className="mx-auto max-w-4xl" aria-busy={busy}>
      <Link href="/account" className="ds-auth-back">← Личный кабинет</Link>
      <header className="mb-8 mt-5"><span className="ds-kicker">Личный кабинет</span><h1 className="mt-2 text-3xl font-semibold">Уведомления</h1><p className="mt-2 text-sm text-[var(--foreground-secondary)]">Сообщения о записях и оплате, настройки напоминаний.</p></header>
      {error && <p role="alert" className="ds-alert is-error mb-5">{error}</p>}
      <p role="status" aria-live="polite" className="mb-5 text-sm">{busy ? "Загрузка…" : message}</p>
      {!settings ? <button type="button" className="ds-secondary-button" disabled={busy} onClick={() => void act("refresh")}>Повторить загрузку</button> : <div className="space-y-6">
        <section className="ds-panel p-5 sm:p-7" aria-labelledby="email-title">
          <h2 id="email-title" className="text-xl font-semibold">Email</h2>
          <p className="mt-3 break-all">{settings.email || "Адрес не указан"}</p>
          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{!settings.emailEnabled ? "Email-уведомления пока недоступны: отправка отключена на стороне сервиса." : settings.email ? "Email-уведомления доступны для этого адреса." : "Добавьте email в профиле, чтобы получать сообщения."}</p>
          <Link href="/account" className="ds-secondary-button mt-4">Изменить email в профиле</Link>
        </section>
        <section className="ds-panel p-5 sm:p-7" aria-labelledby="max-title">
          <h2 id="max-title" className="text-xl font-semibold">MAX</h2>
          <p className="mt-3 font-medium">{settings.maxConnected ? "Подключён" : "Не подключён"}</p>
          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{!settings.maxEnabled ? "Уведомления MAX пока недоступны: сервис отключён. Наличие привязки не означает, что сообщения отправляются." : settings.maxConnected ? "Сервисные сообщения могут приходить в подключённый чат." : "Для подключения самостоятельно начните диалог с официальным ботом и отправьте ему одноразовый код."}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {settings.maxConnected ? <button type="button" className="ds-secondary-button" disabled={busy} onClick={() => { if (window.confirm("Отключить MAX? Сообщения в этот чат больше не будут отправляться.")) void act("unlink"); }}>Отключить MAX</button>
              : <button type="button" className="ds-primary-button" disabled={busy || !settings.maxEnabled} onClick={() => void act("pair")}>{pairing ? "Получить новый код" : "Подключить MAX"}</button>}
            <button type="button" className="ds-secondary-button" disabled={busy} onClick={() => void act("refresh")}>Проверить подключение</button>
          </div>
          {pairing && !settings.maxConnected && <div className="mt-5 rounded-2xl bg-[var(--input-bg)] p-4">
            {expired ? <p role="status">Срок действия кода истёк. Получите новый код.</p> : <>
              <ol className="list-inside list-decimal space-y-3 text-sm"><li><a href={pairing.botUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--primary)] underline">Откройте бота MAX (в новой вкладке)</a> и начните диалог.</li><li>Отправьте боту код: <strong className="select-all break-all font-mono text-lg">{pairing.code}</strong>.</li><li>Вернитесь сюда и нажмите «Проверить подключение».</li></ol>
              <p className="mt-3 text-sm text-[var(--foreground-secondary)]">Код действует до {new Date(pairing.expiresAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (Москва). Не передавайте его другим людям.</p>
            </>}
          </div>}
        </section>
        <section className="ds-panel p-5 sm:p-7" aria-labelledby="reminders-title">
          <h2 id="reminders-title" className="text-xl font-semibold">Необязательные напоминания</h2>
          <p id="reminders-help" className="mt-2 text-sm text-[var(--foreground-secondary)]">Напомним о предстоящем приёме через доступные каналы. Можно отключить оба напоминания.</p>
          {!canRemind && <p className="ds-alert mt-4">Для напоминаний нужен доступный email-канал с адресом или подключённый и доступный MAX.</p>}
          <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void act("save"); }}>
            <fieldset disabled={busy || !canRemind} aria-describedby="reminders-help" className="space-y-4 disabled:opacity-60">
              <legend className="sr-only">Когда напоминать о приёме</legend>
              <label className="ds-consent"><input type="checkbox" checked={draft.reminders24h} onChange={event => setDraft(previous => ({ ...previous, reminders24h: event.target.checked }))} /><span>За 24 часа до приёма</span></label>
              <label className="ds-consent"><input type="checkbox" checked={draft.reminders2h} onChange={event => setDraft(previous => ({ ...previous, reminders2h: event.target.checked }))} /><span>За 2 часа до приёма</span></label>
            </fieldset>
            <button type="submit" className="ds-primary-button" disabled={busy || !canRemind || !changed}>Сохранить настройки</button>
          </form>
        </section>
        <aside className="ds-panel p-5 text-sm text-[var(--foreground-secondary)] sm:p-7"><h2 className="font-semibold text-[var(--foreground)]">Сервисные сообщения</h2><p className="mt-2">Подтверждение, перенос и отмена записи, а также подтверждение оплаты нужны для обслуживания вашей записи и не отключаются настройками напоминаний. Отправка зависит от доступности канала. Это не рекламная рассылка. Медицинские подробности в мессенджер не передаются.</p><p className="mt-2"><Link href="/privacy" className="underline">Политика конфиденциальности</Link></p></aside>
      </div>}
    </div></Container>
  </main></>;
}
