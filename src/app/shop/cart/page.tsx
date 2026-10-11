"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import Navbar from "@/components/Navbar";
import CartItem from "@/components/cart/CartItem";
import OrderSummary from "@/components/cart/OrderSummary";
import EmptyCart from "@/components/cart/EmptyCart";
import { useAccountPrefill } from "@/lib/hooks/use-account-prefill";
import { formatRussianPhoneInput } from "@/lib/phone";

interface CartItemType {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

export default function CartPage() {
  const profile = useAccountPrefill();
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("cart") || "[]") as CartItemType[];
      setCart(stored);
    } catch {
      setCart([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    setName((value) => value || profile.display_name || "");
    setEmail((value) => value || profile.email || "");
    setPhone((value) => value || (profile.phone ? formatRussianPhoneInput(profile.phone) : ""));
    setAddress((value) => value || profile.address || "");
  }, [profile]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);

      localStorage.setItem("cart", JSON.stringify(next));
      window.dispatchEvent(new Event("cartUpdated"));
      return next;
    });
  };

  const removeItem = (productId: string) => {
    setCart((prev) => {
      const next = prev.filter((item) => item.productId !== productId);
      localStorage.setItem("cart", JSON.stringify(next));
      window.dispatchEvent(new Event("cartUpdated"));
      return next;
    });
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const itemsCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const itemsForReceipt = useMemo(() => cart.map((item) => ({
    productId: item.productId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  })), [cart]);

  return (
    <main className="cart-page relative min-h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--foreground)" }}>
      <Navbar />

      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="ambient-sphere -left-[300px] top-[80px] h-[650px] w-[650px]"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="ambient-sphere -right-[300px] top-[35%] h-[650px] w-[650px]"
          style={{ background: "#6366f1" }}
        />
        <div
          className="ambient-sphere left-1/2 top-[70%] h-[500px] w-[500px] -translate-x-1/2"
          style={{ background: "var(--primary)", opacity: 0.035 }}
        />
      </div>

      <section className="relative z-10 mx-auto max-w-[1180px] px-5 pb-24 pt-28 sm:px-8 lg:px-10 lg:pt-32">
        {/* TOP */}
        <div className="mb-12">
          <Link
            href="/shop"
            className="mb-8 inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-60 text-secondary-cart"
          >
            <ArrowLeft className="h-4 w-4" />
            Магазин
          </Link>

          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl text-primary-cart">
                Корзина
              </h1>
              <p className="mt-3 text-sm sm:text-base text-secondary-cart">
                {itemsCount}{" "}
                {itemsCount === 1 ? "товар" : itemsCount < 5 ? "товара" : "товаров"}
              </p>
            </div>
          </div>
        </div>

        {/* EMPTY */}
        {!hydrated ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]" aria-label="Загрузка корзины"><div className="ds-panel h-40 animate-pulse" /><div className="ds-panel h-72 animate-pulse" /></div>
        ) : cart.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px] xl:gap-12">
            {/* CART ITEMS */}
            <div>
              {cart.map((item) => (
                  <CartItem
                    key={item.productId}
                    item={item}
                    onRemove={removeItem}
                    onQuantityChange={updateQuantity}
                  />
                ))}

              <div className="mt-6 flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span className="text-secondary-cart">Безопасная оплата · Электронный чек</span>
              </div>
            </div>

            {/* CHECKOUT */}
            <OrderSummary
              total={total}
              items={itemsForReceipt}
              name={name}
              email={email}
              phone={phone}
              address={address}
              onNameChange={setName}
              onEmailChange={setEmail}
              onPhoneChange={(value) => setPhone(formatRussianPhoneInput(value))}
              onAddressChange={setAddress}
            />
          </div>
        )}
      </section>
    </main>
  );
}
