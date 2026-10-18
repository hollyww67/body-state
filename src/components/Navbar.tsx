"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X, ShoppingCart, UserRound, ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import BodyStateWordmark from "@/components/BodyStateWordmark";
import "./quiet-nav.css";

const primaryLinks = [
  { href: "/rehabilitation", label: "Направления" },
  { href: "/about", label: "О специалисте" },
  { href: "/blog", label: "Блог" },
  { href: "/contact", label: "Контакты" },
  { href: "/shop", label: "Магазин" },
];
const secondaryLinks = [
  { href: "/psychology", label: "Психологическая реабилитация" },
  { href: "/bfm#booking", label: "Физическая реабилитация" },
  { href: "/brt", label: "Биорезонансная коррекция" },
  { href: "/program", label: "Программа" },
  { href: "/consultation", label: "Консультация" },
  { href: "/about-rehabilitation", label: "О реабилитации" },
  { href: "/reviews", label: "Отзывы" },
  { href: "/promotions", label: "Акции" },
  { href: "/media", label: "Медиатека" },
];
const navLinks = [{ href: "/", label: "Главная" }, ...primaryLinks, ...secondaryLinks];

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [shopVisible, setShopVisible] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart: unknown = JSON.parse(localStorage.getItem("cart") || "[]");
        const count = Array.isArray(cart) ? cart.reduce((sum: number, item: unknown) => {
          if (!item || typeof item !== "object") return sum;
          const quantity = "quantity" in item ? item.quantity : undefined;
          return sum + (typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
        }, 0) : 0;
        setCartCount(count);
      } catch { setCartCount(0); }
    };
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
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isMenuOpen) mobileButtonRef.current?.focus();
        else if (isMoreOpen) moreButtonRef.current?.focus();
        setIsMenuOpen(false);
        setIsMoreOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) setIsMoreOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen, isMoreOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsMoreOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    const path = href.split("#")[0];
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  };
  const closeMenus = () => { setIsMenuOpen(false); setIsMoreOpen(false); };

  return (
    <nav className={`quiet-nav${scrolled ? " quiet-nav--scrolled" : ""}`} aria-label="Основная навигация">
      <div className="qn-container">
        <div className="qn-bar">
          <Link href="/" className="qn-brand" aria-label="Body State — главная" onClick={closeMenus}><BodyStateWordmark /></Link>
          <div className="qn-desktop">
            {primaryLinks.filter((link) => shopVisible || link.href !== "/shop").map((link) => <Link key={link.href} href={link.href} className="qn-link" aria-current={isActive(link.href) ? "page" : undefined}>{link.label}</Link>)}
            <div className="qn-more" ref={moreMenuRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsMoreOpen(false); }}>
              <button type="button" ref={moreButtonRef} onClick={() => setIsMoreOpen((open) => !open)} aria-expanded={isMoreOpen} aria-controls="desktop-more-navigation" className="qn-link qn-more-button" data-active={secondaryLinks.some((link) => isActive(link.href)) || undefined}>Ещё<ChevronDown size={14} aria-hidden="true" /></button>
              {isMoreOpen && <div id="desktop-more-navigation" className="qn-dropdown">{secondaryLinks.map((link) => <Link key={link.href} href={link.href} onClick={closeMenus} aria-current={isActive(link.href) ? "page" : undefined}>{link.label}</Link>)}</div>}
            </div>
          </div>
          <div className="qn-actions">
            <ThemeToggle />
            {shopVisible && (
              <Link href="/shop/cart" className="qn-icon qn-cart" aria-label={cartCount > 0 ? `Корзина, товаров: ${cartCount}` : "Корзина"}><ShoppingCart size={19} aria-hidden="true" />{cartCount > 0 && <span className="qn-cart-count" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span>}</Link>
            )}
            <Link href="/account" className="qn-icon" aria-label="Личный кабинет"><UserRound size={19} aria-hidden="true" /></Link>
            <Link href="/rehabilitation#booking" className="qn-booking qn-desktop-booking">Записаться<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button type="button" ref={mobileButtonRef} className="qn-icon qn-menu-button" onClick={() => setIsMenuOpen((open) => !open)} aria-expanded={isMenuOpen} aria-controls="mobile-navigation" aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}>{isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}</button>
          </div>
        </div>
        {isMenuOpen && <div id="mobile-navigation" className="qn-mobile"><div className="qn-mobile-links">{navLinks.filter((link) => shopVisible || link.href !== "/shop").map((link) => <Link key={link.href} href={link.href} onClick={closeMenus} aria-current={isActive(link.href) ? "page" : undefined}>{link.label}</Link>)}</div><Link href="/rehabilitation#booking" onClick={closeMenus} className="qn-booking">Записаться на приём<ArrowUpRight size={18} aria-hidden="true" /></Link></div>}
      </div>
    </nav>
  );
}
