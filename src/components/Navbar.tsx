"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Container from "@/components/ui/Container";

const navLinks = [
  { href: "/", label: "Главная" },
  { href: "/psychology", label: "Психология" },
  { href: "/rehabilitation", label: "Реабилитация" },
  { href: "/program", label: "Программа" },
  { href: "/shop", label: "Магазин" },
  { href: "/reviews", label: "Отзывы" },
  { href: "/about", label: "Об Алёне" },
  { href: "/contact", label: "Контакты" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => setIsMenuOpen(false), [pathname]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "border-b shadow-[0_8px_30px_rgba(15,118,110,0.06)]" : "border-transparent"}`}
      style={{
        background: scrolled ? "color-mix(in srgb, var(--bg) 84%, transparent)" : "color-mix(in srgb, var(--bg) 72%, transparent)",
        borderColor: scrolled ? "var(--glass-border)" : "transparent",
        backdropFilter: "blur(18px) saturate(150%)",
      }}
    >
      <Container>
        <div className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Через тело к состоянию — главная">
            <span className="relative grid h-10 w-10 lg:h-11 lg:w-11 place-items-center overflow-hidden rounded-xl bg-white/70 shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105">
              <Image src="/logo.png" alt="" width={44} height={44} priority unoptimized className="rounded-xl" />
            </span>
            <span className="hidden text-sm font-semibold tracking-[-0.02em] sm:block" style={{ color: "var(--foreground)" }}>
              Через тело к состоянию
            </span>
          </Link>

          <div className="hidden items-center gap-5 lg:flex xl:gap-7">
            {navLinks.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="relative py-2 text-sm font-medium tracking-tight transition-colors"
                  style={{ color: active ? "var(--foreground)" : "var(--foreground-secondary)" }}
                >
                  {link.label}
                  <span className={`absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-[var(--primary)] transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
                </Link>
              );
            })}
          </div>

          <Link href="/contact" className="liquid-btn group relative hidden items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white lg:inline-flex">
            <span className="relative z-10">Записаться</span>
          </Link>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border lg:hidden"
            style={{ color: "var(--foreground)", borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMenuOpen && (
          <div id="mobile-navigation" className="border-t py-5 lg:hidden" style={{ borderColor: "var(--glass-border)" }}>
            <div className="grid gap-1">
              {navLinks.map((link) => {
                const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className="rounded-2xl px-4 py-3 text-base font-medium transition-colors" style={{ color: active ? "var(--primary)" : "var(--foreground)" }}>
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <Link href="/contact" className="liquid-btn mt-4 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-white">
              <span className="relative z-10">Записаться на консультацию</span>
            </Link>
          </div>
        )}
      </Container>
    </nav>
  );
}
