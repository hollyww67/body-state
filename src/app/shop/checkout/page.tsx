'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy checkout stub — payment lives on /shop/cart */
export default function CheckoutPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/shop/cart');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--foreground-secondary)' }}>Переход к оформлению…</p>
    </main>
  );
}
