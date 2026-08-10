"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ShoppingBag, Trash2, ArrowRight, ArrowLeft } from "lucide-react";

interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("cart") || "[]") as CartItem[];
    setCart(items);
    setLoading(false);

    const handler = () => {
      setCart(JSON.parse(localStorage.getItem("cart") || "[]"));
    };
    window.addEventListener("cartUpdated", handler);
    return () => window.removeEventListener("cartUpdated", handler);
  }, []);

  const updateQty = (productId: string, delta: number) => {
    const updated = cart.map((item) => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[];
    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cartUpdated"));
  };

  const removeItem = (productId: string) => {
    const updated = cart.filter((item) => item.productId !== productId);
    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cartUpdated"));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Корзина</h1>
            {cart.length > 0 && (
              <Link href="/shop" className="text-sm flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                <ArrowLeft className="w-4 h-4" /> Продолжить покупки
              </Link>
            )}
          </div>

          {loading ? (
            <p style={{ color: 'var(--foreground-secondary)' }}>Загрузка...</p>
          ) : cart.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--foreground-secondary)' }} />
              <p className="text-lg mb-4" style={{ color: 'var(--foreground-secondary)' }}>Корзина пуста</p>
              <Link href="/shop" className="inline-flex items-center justify-center rounded-full text-white px-6 py-3 font-medium" style={{ background: 'var(--primary)' }}>
                В магазин
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.productId} className="glass-feature rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 m-4" style={{ color: 'var(--foreground-secondary)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/shop/${item.slug}`} className="font-semibold text-sm hover:underline" style={{ color: 'var(--foreground)' }}>{item.name}</Link>
                    <p className="text-sm" style={{ color: 'var(--primary)' }}>{item.price} ₽</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.productId, -1)} className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--foreground)' }}>−</button>
                    <span className="text-sm font-medium w-6 text-center" style={{ color: 'var(--foreground)' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--foreground)' }}>+</button>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="p-2 rounded-xl hover:opacity-70" style={{ color: '#ef4444' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="glass-feature rounded-2xl p-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Итого</span>
                  <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{total} ₽</span>
                </div>
                <Link
                  href="/shop/checkout"
                  className="liquid-btn group relative w-full inline-flex items-center justify-center rounded-full text-white px-8 py-4 font-medium gap-2"
                >
                  <span className="relative z-10">Оформить заказ</span>
                  <ArrowRight className="relative z-10 w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
