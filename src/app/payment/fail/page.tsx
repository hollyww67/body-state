import Link from "next/link";
import { XCircle, RotateCcw, Home } from "lucide-react";

export default function PaymentFailPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-6 pt-32 pb-20 text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: '#FEE2E2' }}>
            <XCircle className="h-14 w-14 text-red-500" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ color: 'var(--foreground)' }}>
          Оплата не прошла
        </h1>
        <p className="mt-4 text-lg" style={{ color: 'var(--foreground-secondary)' }}>
          Попробуйте ещё раз или свяжитесь с нами, если проблема повторится.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/shop/cart"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 font-medium text-white transition-all hover:shadow-lg"
            style={{ background: 'var(--primary)' }}
          >
            <RotateCcw className="h-5 w-5" />
            Вернуться в корзину
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border px-8 py-4 font-medium transition-all hover:bg-white/5"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Home className="h-5 w-5" />
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
