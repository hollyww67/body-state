"use client";

import SiteImage from '@/components/SiteImage';
import { Trash2 } from "lucide-react";
import Link from "next/link";
import QuantityControl from "./QuantityControl";

interface CartItemProps {
  item: {
    productId: string;
    name: string;
    price: number;
    image: string | null;
    quantity: number;
    slug?: string;
  };
  onRemove: (productId: string) => void;
  onQuantityChange: (productId: string, delta: number) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

export default function CartItem({ item, onRemove, onQuantityChange }: CartItemProps) {
  return (
    <div className="ds-panel group relative mb-4 flex gap-4 overflow-hidden p-4 transition-transform hover:-translate-y-0.5 sm:gap-7 sm:p-5">
      {/* hover glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-[70px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "var(--primary)" }}
      />

      <div className="relative flex w-full gap-4 sm:gap-7">
        {/* IMAGE */}
        <div
          className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-28"
          style={{ background: "rgba(255,255,255,.04)" }}
        >
          {item.image ? (
            <SiteImage
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-secondary-cart">Нет фото</span>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {item.slug ? <Link href={`/shop/${item.slug}`} className="text-base font-semibold leading-6 transition-colors hover:text-[var(--primary)] sm:text-lg">{item.name}</Link> : <h2 className="text-base font-semibold leading-6 sm:text-lg">{item.name}</h2>}
              <p className="mt-1 text-xs uppercase tracking-wider text-secondary-cart">
                Косметика
              </p>
            </div>

            <button
              onClick={() => onRemove(item.productId)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[var(--foreground-secondary)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              aria-label="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-end justify-between gap-4">
            <QuantityControl
              quantity={item.quantity}
              onDecrease={() => onQuantityChange(item.productId, -1)}
              onIncrease={() => onQuantityChange(item.productId, 1)}
            />

            <div className="whitespace-nowrap text-right">
              <div className="text-xs text-secondary-cart">{formatPrice(item.price)} ₽</div>
              <div className="mt-1 text-xl font-bold tracking-tight text-primary-cart">
                {formatPrice(item.price * item.quantity)} ₽
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
