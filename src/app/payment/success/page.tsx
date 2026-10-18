"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import BookingReceipt from '@/components/BookingReceipt';
import type {BookingJourney} from '@/lib/booking-journey';
import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Home, Loader2, Mail, ShieldCheck } from "lucide-react";

type ViewState = "checking" | "paid" | "pending" | "failed";

export default function PaymentSuccessPage() {
  const [state, setState] = useState<ViewState>("checking");
  const [bookings,setBookings]=useState<BookingJourney[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    const token = params.get("token");
    if (!orderId || !token) {
      setState("failed");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/payment/status?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Не удалось проверить платеж");
        if (cancelled) return;
        setBookings(result.bookings||[]);
        if (result.status === "paid") {
          localStorage.removeItem("cart");
          window.dispatchEvent(new Event("cartUpdated"));
          setState("paid");
          return;
        }
        if (["failed", "cancelled", "refunded"].includes(result.status)) {
          setState("failed");
          return;
        }
        if (attempts < 16) timer = setTimeout(check, 2000);
        else setState("pending");
      } catch {
        if (cancelled) return;
        if (attempts < 4) timer = setTimeout(check, 2000);
        else setState("pending");
      }
    };
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  const paid = state === "paid";
  const checking = state === "checking";
  const pending = state === "pending";
  const title = paid ? "Оплата подтверждена" : checking ? "Проверяем оплату" : pending ? "Платёж обрабатывается" : "Оплата не подтверждена";
  const description = paid
    ? "Информация об оплате сохранена в системе Body State. Данные записи доступны ниже или в личном кабинете."
    : checking
      ? "Ожидаем защищённое подтверждение от банка. Обычно это занимает несколько секунд."
      : pending
        ? "Банк ещё не передал финальный статус. Заказ сохранён — проверьте его в личном кабинете чуть позже."
        : "Мы не получили подтверждение оплаты. Проверьте состояние существующего заказа в личном кабинете перед повторной оплатой.";

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--foreground)" }}>
      <Navbar />
      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5 py-20">
        <section className="glass-feature w-full rounded-[32px] p-7 text-center shadow-2xl sm:p-10">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: paid ? "#10b981" : state === "failed" ? "#ef4444" : "var(--primary)" }}>
            {checking ? <Loader2 className="h-12 w-12 animate-spin text-white" /> : paid ? <CheckCircle2 className="h-12 w-12 text-white" /> : pending ? <Clock3 className="h-12 w-12 text-white" /> : <AlertCircle className="h-12 w-12 text-white" />}
          </div>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7" style={{ color: "var(--foreground-secondary)" }}>{description}</p>
          {bookings.map(b=><div key={`${b.id}:${b.status}:${b.paymentStatus}`} className="mt-6 text-left"><BookingReceipt initial={b} accessToken={typeof window!=='undefined'?sessionStorage.getItem(`booking-access:${b.service}:${b.id}`)||'':''}/></div>)}

          <div className="mt-8 grid gap-3 rounded-3xl border p-5 text-left sm:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--glass-bg)" }}>
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} /><div><p className="font-medium">Безопасная проверка</p><p className="mt-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>Статус берётся из заказа на сервере, а не из адресной строки.</p></div></div>
            <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} /><div><p className="font-medium">Электронный чек</p><p className="mt-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>После подтверждения чек отправляет кассовый сервис.</p></div></div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="liquid-btn inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-white"><Home className="h-5 w-5" />На главную</Link>
            <Link href="/account" className="ds-secondary-button inline-flex flex-1 items-center justify-center gap-2 px-6 py-3.5 font-semibold"><CalendarDays className="h-5 w-5" />Открыть кабинет</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
