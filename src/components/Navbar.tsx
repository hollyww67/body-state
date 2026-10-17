"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X, ShoppingCart, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import Container from "@/components/ui/Container";
import ThemeToggle from "@/components/ThemeToggle";

const primaryLinks = [
  { href: "/psychology", label: "Псих. реабилитация" },
  { href: "/bfm#booking", label: "Физ. реабилитация" },
  { href: "/program", label: "Программа" },
  { href: "/shop", label: "Магазин" },
];

const secondaryLinks = [
  { href: "/promotions", label: "Акции" },
  { href: "/reviews", label: "Отзывы" },
  { href: "/about", label: "Об Алёне" },
  { href: "/contact", label: "Контакты" },
];

const navLinks = [
  { href: "/", label: "Главная" },
  ...primaryLinks,
  ...secondaryLinks,
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [shopVisible, setShopVisible] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      fetch("/api/site-visibility", { cache: "no-store", signal: requestController.signal })
        .then((r) => r.ok ? r.json() : { shopVisible: false })
        .then((data) => { if (active && !requestController.signal.aborted) setShopVisible(data.shopVisible === true); })
        .catch(() => { if (active && !requestController.signal.aborted) setShopVisible(false); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", refresh); };
  }, [pathname]);

  // Обновление количества товаров в корзине
  const updateCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const count = cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      setCartCount(count);
    } catch {}
  };

  useEffect(() => {
    updateCartCount();
    window.addEventListener("cartUpdated", updateCartCount);
    window.addEventListener("storage", updateCartCount);
    return () => {
      window.removeEventListener("cartUpdated", updateCartCount);
      window.removeEventListener("storage", updateCartCount);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsMoreOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) setIsMoreOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsMoreOpen(false);
  }, [pathname]);

  return (
    <nav
      className={`site-nav fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "site-nav--scrolled border-b" : "border-transparent"}`}
      style={{
        background: scrolled ? "color-mix(in srgb, var(--bg) 90%, transparent)" : "color-mix(in srgb, var(--bg) 76%, transparent)",
        borderColor: scrolled ? "var(--glass-border)" : "transparent",
        backdropFilter: "blur(18px) saturate(150%)",
      }}
    >
      <Container>
        <div className="flex h-[68px] items-center justify-between lg:h-[84px]">
          {/* Логотип */}
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Через тело к состоянию — главная">
            <span className="brand-mark relative grid h-11 w-11 lg:h-12 lg:w-12 place-items-center overflow-hidden rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5">
              <Image src="/logo.png" alt="" width={48} height={48} priority unoptimized className="rounded-2xl" />
            </span>
            <span className="hidden leading-tight 2xl:block" style={{ color: "var(--foreground)" }}>
              <span className="block text-[13px] font-semibold tracking-[-0.02em]">Через тело к состоянию</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>реабилитолог · хотьково</span>
            </span>
          </Link>

          {/* Десктопная навигация */}
          <div className="hidden items-center gap-5 lg:flex xl:gap-7">
            {primaryLinks.filter((link) => shopVisible || link.href !== "/shop").map((link) => {
              const linkPath = link.href.split("#")[0];
              const active = linkPath === "/" ? pathname === "/" : pathname.startsWith(linkPath);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="nav-link relative py-2 text-[13px] font-medium tracking-tight transition-colors"
                  style={{ color: active ? "var(--foreground)" : "var(--foreground-secondary)" }}
                >
                  {link.label}
                  <span className={`absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-[var(--primary)] transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
                </Link>
              );
            })}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((open) => !open)}
                aria-expanded={isMoreOpen}
                aria-controls="desktop-more-navigation"
                className="nav-link inline-flex items-center gap-1 py-2 text-[13px] font-medium tracking-tight transition-colors"
                style={{ color: secondaryLinks.some((link) => pathname.startsWith(link.href)) ? "var(--foreground)" : "var(--foreground-secondary)" }}
              >
                Ещё <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isMoreOpen ? "rotate-180" : ""}`} />
              </button>
              {isMoreOpen && (
                <div id="desktop-more-navigation" className="absolute left-1/2 top-full mt-3 w-48 -translate-x-1/2 rounded-2xl border p-2 shadow-xl" style={{ background: "var(--surface-elevated)", borderColor: "var(--glass-border)" }}>
                  {secondaryLinks.map((link) => {
                    const active = pathname.startsWith(link.href);
                    return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className="block rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--primary-muted)]" style={{ color: active ? "var(--primary)" : "var(--foreground)" }}>{link.label}</Link>;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Кнопка корзины и запись */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Корзина доступна только с магазином */}
            {shopVisible && (
              <Link
              href="/shop/cart"
              className="nav-icon relative grid h-10 w-10 place-items-center rounded-2xl border transition-all hover:-translate-y-0.5"
              style={{ color: "var(--foreground)", borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
              aria-label="Корзина"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            )}

            <Link href="/account" className="nav-icon grid h-10 w-10 place-items-center rounded-2xl border transition-all hover:-translate-y-0.5" style={{ color: "var(--foreground)", borderColor: "var(--glass-border)", background: "var(--glass-bg)" }} aria-label="Личный кабинет">
              <UserRound className="h-5 w-5" />
            </Link>

            {/* Кнопка записаться (десктоп) */}
            <Link href="/rehabilitation#booking" className="liquid-btn group relative hidden items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white lg:inline-flex">
              <span className="relative z-10">Записаться</span>
            </Link>

            {/* Мобильная кнопка меню */}
            <button
              type="button"
              className="nav-icon grid h-10 w-10 place-items-center rounded-2xl border lg:hidden"
              style={{ color: "var(--foreground)", borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {isMenuOpen && (
          <div id="mobile-navigation" className="mobile-navigation border-t py-5 lg:hidden" style={{ borderColor: "var(--glass-border)" }}>
            <div className="grid grid-cols-2 gap-2">
              {navLinks.filter((link) => shopVisible || link.href !== "/shop").map((link) => {
                const linkPath = link.href.split("#")[0];
                const active = linkPath === "/" ? pathname === "/" : pathname.startsWith(linkPath);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className="rounded-2xl border px-4 py-3 text-sm font-medium transition-colors"
                    style={{ color: active ? "var(--primary)" : "var(--foreground)", borderColor: active ? "var(--primary)" : "var(--glass-border)", background: active ? "var(--primary-muted)" : "var(--glass-bg)" }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <Link
              href="/rehabilitation#booking"
              className="liquid-btn mt-4 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-white"
            >
              <span className="relative z-10">Записаться на консультацию</span>
            </Link>
          </div>
        )}
      </Container>
    </nav>
  );
}
