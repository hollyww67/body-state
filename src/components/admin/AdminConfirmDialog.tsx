"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native modal top layer escapes every sidebar/animation stacking context. */
export default function AdminConfirmDialog({ title, children, onCancel, onConfirm }: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm?: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { if (!busy && error) cancel.current?.focus(); }, [busy, error]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyStyle = document.body.style.cssText;
    const scrollY = window.scrollY;
    // Fixed body also prevents background scrolling in iOS Safari.
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty("--modal-height", `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty("--modal-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    element.showModal(); // Browser makes the rest of the document inert and traps focus.
    (cancel.current ?? element.querySelector<HTMLElement>('button, input, select, textarea, a[href]'))?.focus();
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      element.close();
      document.body.style.cssText = bodyStyle;
      window.scrollTo(0, scrollY);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else {
        const heading = document.querySelector<HTMLElement>('main h1');
        if (heading) {
          const oldTabIndex = heading.getAttribute('tabindex');
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
          if (oldTabIndex === null) heading.removeAttribute('tabindex');
          else heading.setAttribute('tabindex', oldTabIndex);
        }
      }
    };
  }, []);

  const confirm = async () => {
    if (pending.current || !onConfirm) return;
    pending.current = true;
    dialog.current?.focus();
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onCancelRef.current();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить. Попробуйте ещё раз.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <dialog ref={dialog} tabIndex={-1} className={`admin-confirm-dialog ${onConfirm ? "" : "admin-content admin-modal-general"}`} role={onConfirm ? "alertdialog" : "dialog"} aria-modal="true"
      aria-label={onConfirm ? undefined : title} aria-labelledby={onConfirm ? titleId : undefined} aria-describedby={onConfirm ? descriptionId : undefined} aria-busy={busy}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={event => { event.preventDefault(); if (!pending.current) onCancelRef.current(); }}>
      {onConfirm ? <section className="admin-confirm-panel">
        <header><h2 id={titleId}>{title}</h2></header>
        <div className="admin-confirm-body">
          <div id={descriptionId}>{children}</div>
          {error && <p className="admin-confirm-error" role="alert">{error}</p>}
        </div>
        <footer>
          <button ref={cancel} type="button" disabled={busy} onClick={() => { if (!pending.current) onCancelRef.current(); }}>Отмена</button>
          <button type="button" className="admin-confirm-danger" disabled={busy} onClick={() => void confirm()}>{busy ? "Удаление…" : "Удалить"}</button>
        </footer>
      </section> : children}
    </dialog>, document.body,
  );
}

export function AdminModal({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  return <AdminConfirmDialog title={title} onCancel={onCancel}>{children}</AdminConfirmDialog>;
}
