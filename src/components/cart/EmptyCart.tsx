"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ShoppingBag } from "lucide-react";

export default function EmptyCart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="ds-panel relative overflow-hidden px-6 py-24 text-center sm:px-10"
    >
      <div
        className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full blur-[80px]"
        style={{ background: "var(--primary)", opacity: 0.15 }}
      />

      <div
        className="relative mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] border"
        style={{ borderColor: "var(--glass-border)", background: "var(--primary-muted)" }}
      >
        <ShoppingBag className="h-10 w-10 animate-pulse" style={{ color: "var(--primary)" }} />
      </div>

      <h2 className="text-2xl font-semibold text-primary-cart">В корзине пока пусто</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-secondary-cart">
        Загляните в магазин и выберите товары, которые хотите приобрести.
      </p>

      <Link
        href="/shop"
        className="ds-primary-button group mt-8"
      >
        Перейти в магазин
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
