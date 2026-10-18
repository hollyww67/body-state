"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Flag, X } from "lucide-react";

type Props = {
  reviewId: string;
  reviewAuthor: string;
  onClose: () => void;
};

const reasons = [
  ["personal_data", "Раскрыты персональные данные"],
  ["false_information", "Недостоверная информация"],
  ["offensive", "Оскорбления или травля"],
  ["prohibited_content", "Запрещённый контент"],
  ["rights_violation", "Нарушение моих прав"],
  ["other", "Другая причина"],
] as const;

export default function ReviewReportDialog({ reviewId, reviewAuthor, onClose }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyStyle = document.body.style.cssText;
    const scrollY = window.scrollY;
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    element.showModal();
    closeButton.current?.focus();
    return () => {
      element.close();
      document.body.style.cssText = bodyStyle;
      window.scrollTo(0, scrollY);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { if (sent) closeButton.current?.focus(); }, [sent]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!reason) return setError("Выберите причину жалобы.");
    if (email && !consent) return setError("Подтвердите согласие на обработку e-mail.");

    setSubmitting(true);
    try {
      const response = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details, reporter_email: email, consent }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось отправить жалобу");
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить жалобу");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <dialog className="quiet-public qp-portal" ref={dialog} tabIndex={-1} aria-modal="true" aria-labelledby={titleId}
      style={{ position: "fixed", inset: 0, margin: 0, width: "100%", maxWidth: "none", height: "100%", maxHeight: "none", padding: 0, border: 0, background: "transparent", color: "inherit" }}
      onCancel={event => { event.preventDefault(); onCloseRef.current(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
      }}
    >
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="w-full max-w-lg rounded-2xl border p-6 shadow-xl md:p-8"
        style={{ background: "var(--surface-elevated)", borderColor: "var(--glass-border)", color: "var(--foreground)" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
              <Flag className="h-5 w-5" />
            </span>
            <div>
              <h2 id={titleId} className="text-xl font-semibold">Пожаловаться на отзыв</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>Автор: {reviewAuthor}</p>
            </div>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} className="nav-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: "var(--glass-border)" }} aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="py-5 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12" style={{ color: "var(--primary)" }} />
            <p className="text-lg font-semibold">Жалоба принята</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>Мы проверим отзыв и при необходимости ограничим публикацию. Контакт не обязателен для рассмотрения.</p>
            <button type="button" onClick={onClose} className="liquid-btn mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white">Закрыть</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="mb-2 block text-sm font-medium">Причина</label>
              <select id="report-reason" required value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                <option value="">Выберите причину</option>
                {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="report-details" className="mb-2 block text-sm font-medium">Что именно не так <span className="font-normal" style={{ color: "var(--foreground-secondary)" }}>(необязательно)</span></label>
              <textarea id="report-details" rows={4} maxLength={1500} value={details} onChange={(event) => setDetails(event.target.value)} className="w-full resize-none rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--foreground)" }} placeholder="Опишите нарушение без лишних персональных данных" />
            </div>
            <div>
              <label htmlFor="report-email" className="mb-2 block text-sm font-medium">E-mail для ответа <span className="font-normal" style={{ color: "var(--foreground-secondary)" }}>(необязательно)</span></label>
              <input id="report-email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--foreground)" }} placeholder="name@example.ru" />
            </div>
            {email && (
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-5" style={{ color: "var(--foreground-secondary)" }}>
                <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" />
                <span>Согласен(на) на обработку e-mail для рассмотрения жалобы на условиях <Link href="/personal-data-consent" target="_blank" className="underline underline-offset-2">согласия</Link> и <Link href="/privacy" target="_blank" className="underline underline-offset-2">Политики</Link>.</span>
              </label>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-full border px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Отмена</button>
              <button type="submit" disabled={submitting} className="liquid-btn rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Отправляем…" : "Отправить жалобу"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
    </dialog>,
    document.body,
  );
}
