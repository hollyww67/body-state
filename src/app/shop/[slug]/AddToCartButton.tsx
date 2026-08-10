"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Minus, ShoppingBag } from "lucide-react";

interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

export default function AddToCartButton({
  productId, slug, name, price, image, stock,
}: {
  productId: string; slug: string; name: string; price: number; image: string | null; stock: number;
}) {
  const [qty, setQty] = useState(0);

  const loadQty = useCallback(() => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]") as CartItem[];
    const item = cart.find((i) => i.productId === productId);
    setQty(item ? item.quantity : 0);
  }, [productId]);

  useEffect(() => {
    loadQty();
    window.addEventListener("cartUpdated", loadQty);
    return () => window.removeEventListener("cartUpdated", loadQty);
  }, [loadQty]);

  const updateCart = (delta: number) => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]") as CartItem[];
    const idx = cart.findIndex((i) => i.productId === productId);
    if (idx >= 0) {
      const newQty = cart[idx].quantity + delta;
      if (newQty <= 0) cart.splice(idx, 1);
      else cart[idx].quantity = newQty;
    } else if (delta > 0) {
      cart.push({ productId, slug, name, price, image, quantity: delta });
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    setQty(cart.find((i) => i.productId === productId)?.quantity || 0);
    window.dispatchEvent(new Event("cartUpdated"));
  };

  if (stock === 0) {
    return (
      <button disabled className="w-full py-4 rounded-full text-sm font-medium opacity-50 cursor-not-allowed" style={{ background: 'var(--foreground-secondary)', color: 'white' }}>
        Нет в наличии
      </button>
    );
  }

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--foreground-secondary)' }}>В наличии: {stock} шт.</p>
      {qty === 0 ? (
        <button onClick={() => updateCart(1)} className="w-full py-4 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5" style={{ background: 'var(--primary)' }}>
          <ShoppingBag className="w-4 h-4" /> В корзину — {price} ₽
        </button>
      ) : (
        <div className="flex items-center gap-3 w-full">
          <button onClick={() => updateCart(-1)} className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
            <Minus className="w-5 h-5" />
          </button>
          <span className="flex-1 text-center text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{qty}</span>
          <button
            onClick={() => updateCart(1)}
            disabled={qty >= stock}
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium text-white transition-all disabled:opacity-50"
            style={{ background: qty >= stock ? 'var(--foreground-secondary)' : 'var(--primary)' }}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
