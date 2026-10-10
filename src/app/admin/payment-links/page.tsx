"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeRussianRuble,
  Ban,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Share2,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { formatRussianPhoneInput } from "@/lib/phone";

type PaymentLink = {
  id: string;
  name: string;
  amount: number;
  email: string;
  phone: string;
  serviceCode: string;
  countsAsVisit: boolean;
  status: string;
  paymentUrl: string;
  paymentId: string;
  expiresAt: string | null;
  createdAt: string;
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Ожидает оплаты", className: "is-pending" },
  paid: { label: "Оплачено", className: "is-paid" },
  failed: { label: "Ошибка", className: "is-failed" },
  cancelled: { label: "Отменено", className: "is-cancelled" },
  refunded: { label: "Возврат", className: "is-refunded" },
  expired: { label: "Истекла", className: "is-expired" },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function AdminPaymentLinksPage() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [lifetimeDays, setLifetimeDays] = useState("7");
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [latestLink, setLatestLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadLinks = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/payment-links", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить ссылки");
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить ссылки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLinks(true);
  }, [loadLinks]);

  const amountPreview = useMemo(() => {
    const parsed = Number(amount.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? formatMoney(parsed) : "0 ₽";
  }, [amount]);

  const createLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/admin/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount, email, phone, serviceCode, lifetimeDays: Number(lifetimeDays) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.link) throw new Error(data.error || "Не удалось сформировать ссылку");

      const created = data.link as PaymentLink;
      setLatestLink(created);
      setLinks((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setName("");
      setAmount("");
      setPhone("");
      setServiceCode("");
      toast.success("Ссылка на оплату сформирована");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сформировать ссылку");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (link: PaymentLink) => {
    try {
      await copyText(link.paymentUrl);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const shareLink = async (link: PaymentLink) => {
    const text = `${link.name} — ${formatMoney(link.amount)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Ссылка на оплату", text, url: link.paymentUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink(link);
  };

  const cancelLink = async (link: PaymentLink) => {
    if (!link.paymentId) return;
    setCancellingId(link.id);
    try {
      const response = await fetch("/api/payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: link.paymentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не удалось отменить ссылку");
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, status: "cancelled" } : item));
      setLatestLink((current) => current?.id === link.id ? { ...current, status: "cancelled" } : current);
      toast.success("Ссылка отменена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отменить ссылку");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="admin-payment-links-page">
      <section className="admin-payment-link-hero">
        <div>
          <p className="admin-section-eyebrow">Быстрая оплата</p>
          <h2>Сформировать ссылку</h2>
          <p>Укажите назначение, сумму и контакты клиента. Если выбрана процедура, успешная оплата будет учтена в его программе лояльности.</p>
        </div>
        <span className="admin-payment-link-hero-icon"><Link2 aria-hidden="true" /></span>
      </section>

      <div className="admin-payment-link-grid">
        <form className="admin-payment-link-form" onSubmit={createLink}>
          <header>
            <div>
              <h3>Новый платёж</h3>
              <p>Платёжная страница создаётся в TBank</p>
            </div>
            <span>01</span>
          </header>

          <div className="admin-payment-link-fields">
            <label>
              <span>Наименование</span>
              <div className="admin-payment-field">
                <Link2 aria-hidden="true" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например, консультация"
                  minLength={2}
                  maxLength={128}
                  autoComplete="off"
                  required
                />
              </div>
            </label>

            <label>
              <span>Стоимость</span>
              <div className="admin-payment-field">
                <BadgeRussianRuble aria-hidden="true" />
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="5 000"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                />
                <strong>{amountPreview}</strong>
              </div>
            </label>

            <label>
              <span>E-mail для чека</span>
              <div className="admin-payment-field">
                <Mail aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="client@example.ru"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
              <small>Используйте адрес, который клиент предоставил для получения чека.</small>
            </label>

            <label>
              <span>Телефон клиента</span>
              <div className="admin-payment-field">
                <Phone aria-hidden="true" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatRussianPhoneInput(event.target.value))}
                  placeholder="+7 999 123-45-67"
                  autoComplete="tel"
                  inputMode="tel"
                  required={Boolean(serviceCode)}
                />
              </div>
              <small>Нужен для привязки оплаты и посещения к личному кабинету.</small>
            </label>

            <label>
              <span>Процедура для учёта посещения</span>
              <div className="admin-payment-field">
                <Stethoscope aria-hidden="true" />
                <select value={serviceCode} onChange={(event) => setServiceCode(event.target.value)}>
                  <option value="">Не учитывать как посещение</option>
                  <option value="bfm">Физическая реабилитация</option>
                  <option value="brt">БРТ</option>
                  <option value="psychology">Психологическая реабилитация</option>
                  <option value="psychology_program">Психологическая программа</option>
                </select>
              </div>
            </label>

            <label>
              <span>Срок действия</span>
              <div className="admin-payment-field">
                <Clock3 aria-hidden="true" />
                <select value={lifetimeDays} onChange={(event) => setLifetimeDays(event.target.value)}>
                  <option value="1">1 день</option>
                  <option value="3">3 дня</option>
                  <option value="7">7 дней</option>
                  <option value="14">14 дней</option>
                  <option value="30">30 дней</option>
                </select>
              </div>
            </label>
          </div>

          <button type="submit" className="admin-payment-create-button" disabled={creating}>
            {creating ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            <span>{creating ? "Формируем ссылку…" : "Сформировать ссылку"}</span>
          </button>
        </form>

        <section className={`admin-payment-link-result ${latestLink ? "has-link" : ""}`} aria-live="polite">
          {latestLink ? (
            <>
              <span className="admin-payment-result-icon"><Check aria-hidden="true" /></span>
              <p className="admin-section-eyebrow">Готово к отправке</p>
              <h3>{latestLink.name}</h3>
              <strong>{formatMoney(latestLink.amount)}</strong>
              <p>Чек: {latestLink.email}</p>
              {latestLink.countsAsVisit && <p>{latestLink.phone} · посещение будет учтено после оплаты</p>}
              <div className="admin-payment-url"><span>{latestLink.paymentUrl}</span></div>
              <div className="admin-payment-result-actions">
                <button type="button" onClick={() => void copyLink(latestLink)}><Copy aria-hidden="true" />Скопировать</button>
                <button type="button" className="is-primary" onClick={() => void shareLink(latestLink)}><Share2 aria-hidden="true" />Поделиться</button>
                <a href={latestLink.paymentUrl} target="_blank" rel="noreferrer" aria-label="Открыть платёжную страницу"><ExternalLink aria-hidden="true" /></a>
              </div>
              <small>Ссылка действует до {formatDate(latestLink.expiresAt)}</small>
            </>
          ) : (
            <>
              <span className="admin-payment-result-icon"><Link2 aria-hidden="true" /></span>
              <h3>Здесь появится ссылка</h3>
              <p>После формирования её можно скопировать, открыть или отправить через системное меню «Поделиться».</p>
            </>
          )}
        </section>
      </div>

      <section className="admin-payment-link-history">
        <header>
          <div>
            <p className="admin-section-eyebrow">Последние операции</p>
            <h3>История платёжных ссылок</h3>
          </div>
          <button type="button" onClick={() => void loadLinks()} disabled={refreshing} aria-label="Обновить историю">
            <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="admin-payment-history-empty"><LoaderCircle className="animate-spin" aria-hidden="true" />Загружаем ссылки…</div>
        ) : links.length === 0 ? (
          <div className="admin-payment-history-empty"><Link2 aria-hidden="true" />Сформированных ссылок пока нет</div>
        ) : (
          <div className="admin-payment-history-list">
            {links.map((link) => {
              const expired = link.status === "pending" && Boolean(link.expiresAt) && new Date(link.expiresAt!).getTime() <= Date.now();
              const status = STATUS[expired ? "expired" : link.status] || { label: link.status, className: "" };
              const canUse = link.status === "pending" && !expired && Boolean(link.paymentUrl);
              return (
                <article key={link.id} className="admin-payment-history-row">
                  <div className="admin-payment-history-copy">
                    <div><strong>{link.name}</strong><span className={`admin-payment-status ${status.className}`}>{status.label}</span></div>
                    <p>{link.email}{link.phone ? ` · ${link.phone}` : ""} · создана {formatDate(link.createdAt)}</p>
                    {link.countsAsVisit && <small>Учитывается в программе лояльности после оплаты</small>}
                    <small>Действует до {formatDate(link.expiresAt)}</small>
                  </div>
                  <strong className="admin-payment-history-amount">{formatMoney(link.amount)}</strong>
                  <div className="admin-payment-history-actions">
                    <button type="button" onClick={() => void copyLink(link)} disabled={!canUse} aria-label="Скопировать ссылку"><Copy aria-hidden="true" /></button>
                    <button type="button" onClick={() => void shareLink(link)} disabled={!canUse} aria-label="Поделиться ссылкой"><Share2 aria-hidden="true" /></button>
                    {canUse && <a href={link.paymentUrl} target="_blank" rel="noreferrer" aria-label="Открыть ссылку"><ExternalLink aria-hidden="true" /></a>}
                    {link.status === "pending" && link.paymentId && (
                      <button type="button" className="is-danger" onClick={() => void cancelLink(link)} disabled={cancellingId === link.id} aria-label="Отменить ссылку">
                        {cancellingId === link.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
