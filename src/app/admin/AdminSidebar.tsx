"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar, CalendarDays, ChevronLeft, ChevronsLeft, ChevronsRight, Clock,
  FileText, HeartPulse, Image, LayoutDashboard, Menu, MessageSquare, Package,
  Award, BadgeRussianRuble, Gift, Link2, Search, Settings, ShoppingBag, Sparkles, Star, TicketPercent, Video, X,
} from "lucide-react";

const groups = [
  {
    label: "Приёмы и клиенты",
    items: [
      { href: "/admin/dashboard", label: "Рабочий день", icon: LayoutDashboard },
      { href: "/admin/calendar", label: "Календарь приёмов", icon: Calendar },
      { href: "/admin/bookings", label: "Записи и клиенты", icon: CalendarDays },
      { href: "/admin/slots", label: "Время для записи", icon: Clock },
      { href: "/admin/psychology-rooms", label: "Онлайн-консультации", icon: Video },
    ],
  },
  {
    label: "Оплата и магазин",
    items: [
      { href: "/admin/orders", label: "Заказы и оплаты", icon: Package },
      { href: "/admin/payment-links", label: "Ссылки на оплату", icon: Link2 },
      { href: "/admin/payment-cases", label: "Проверка платежей", icon: BadgeRussianRuble },
      { href: "/admin/products", label: "Товары", icon: ShoppingBag },
      { href: "/admin/prices", label: "Цены", icon: BadgeRussianRuble },
    ],
  },
  {
    label: "Скидки и акции",
    items: [
      { href: "/admin/promotions", label: "Акции на сайте", icon: Gift },
      { href: "/admin/promo-codes", label: "Промокоды", icon: TicketPercent },
      { href: "/admin/loyalty", label: "Бонусы за посещения", icon: Award },
    ],
  },
  {
    label: "Содержимое сайта",
    items: [
      { href: "/admin/psychology", label: "Программы психологии", icon: HeartPulse },
      { href: "/admin/pages", label: "Тексты страниц", icon: FileText },
      { href: "/admin/reviews", label: "Отзывы и жалобы", icon: Star },
      { href: "/admin/media", label: "Фото «До и после»", icon: Image },
    ],
  },
  {
    label: "Сервис",
    items: [
      { href: "/admin/notifications", label: "Журнал отправок", icon: MessageSquare },
      { href: "/admin/faq", label: "Ответы чат-бота", icon: MessageSquare },
      { href: "/admin/settings", label: "Настройки", icon: Settings },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    try { setCollapsed(desktop && localStorage.getItem("admin-sidebar-collapsed") === "true"); } catch { /* Optional preference. */ }
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      setMobileOpen(false);
      try { setCollapsed(media.matches && localStorage.getItem("admin-sidebar-collapsed") === "true"); } catch { setCollapsed(false); }
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const body = document.body;
    const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    // overflow:hidden alone does not lock the document reliably in iOS standalone mode.
    Object.assign(body.style, { overflow: "hidden", position: "fixed", top: `-${scrollY}px`, width: "100%" });
    const background = Array.from(document.querySelectorAll<HTMLElement>('.admin-main,.admin-mobile-bar,.admin-mobile-bottom-nav'));
    const inertBefore = background.map(el => el.inert);
    background.forEach(el => { el.inert = true; });
    const viewport = window.visualViewport;
    const sidebar = sidebarRef.current;
    const fitViewport = () => {
      sidebar?.style.setProperty('--menu-height', `${viewport?.height || window.innerHeight}px`);
      sidebar?.style.setProperty('--menu-top', `${viewport?.offsetTop || 0}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    // Focusing search opens the software keyboard and can zoom the whole PWA on iOS.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(document.querySelectorAll<HTMLElement>('#admin-navigation a[href],#admin-navigation button:not(:disabled),#admin-navigation input')).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      Object.assign(body.style, saved);
      background.forEach((el, i) => { el.inert = inertBefore[i]; });
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.clearTimeout(focusTimer);
      sidebar?.style.removeProperty('--menu-height');
      sidebar?.style.removeProperty('--menu-top');
      document.removeEventListener("keydown", keydown);
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem("admin-sidebar-collapsed", String(next)); } catch { /* Optional preference. */ }
      return next;
    });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const mobileItems = [
    { href: "/admin/dashboard", label: "Сегодня", icon: LayoutDashboard },
    { href: "/admin/calendar", label: "Календарь", icon: Calendar },
    { href: "/admin/bookings", label: "Записи", icon: CalendarDays },
    { href: "/admin/orders", label: "Заказы", icon: ShoppingBag },
  ];

  return (
    <>
      <div className="admin-mobile-bar">
        <button type="button" onClick={() => { setCollapsed(false); setMobileOpen(true); }} className="admin-mobile-menu" aria-label="Открыть меню" aria-expanded={mobileOpen} aria-controls="admin-navigation">
          <Menu className="h-5 w-5" />
        </button>
        <div className="admin-mobile-brand">
          <span className="admin-brand-mark"><Sparkles className="h-4 w-4" /></span>
          <span>Центр управления</span>
        </div>
      </div>

      {mobileOpen && <button type="button" className="admin-sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" tabIndex={-1} />}

      <aside ref={sidebarRef} id="admin-navigation" aria-label="Меню администратора" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} className={`admin-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <span className="admin-brand-mark"><Sparkles className="h-5 w-5" /></span>
          {!collapsed && (
            <div className="admin-brand-copy">
              <strong>Центр управления</strong>
              <span>Практика и магазин</span>
            </div>
          )}
          <button type="button" onClick={toggleCollapsed} className="admin-collapse-button" aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
          <button ref={closeRef} type="button" onClick={() => setMobileOpen(false)} className="admin-close-button" aria-label="Закрыть меню">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!collapsed && <label className="admin-nav-search"><Search size={16} aria-hidden="true" /><input id="admin-section-search" type="search" aria-label="Найти раздел" placeholder="Найти раздел или действие" value={query} onChange={e => setQuery(e.target.value)} /></label>}
        <nav className="admin-nav" aria-label="Разделы админки">
          {groups.map((group, index) => {
            const normalize = (s: string) => s.toLowerCase().replaceAll("ё", "е");
            const aliases: Record<string, string> = { slots: "слоты расписание перерыв месяц", bookings: "заявки телефон имя клиент перенос отмена", pages: "редактор диплом сертификат", notifications: "уведомления sms email почта", loyalty: "лояльность", settings: "пароль тема", prices: "стоимость прайс", "payment-links": "чек счет", "payment-cases": "возврат разбор", faq: "faq" };
            const items = group.items.filter(item => normalize(`${item.label} ${group.label} ${aliases[item.href.split('/').pop()!] || ''}`).includes(normalize(query.trim())));
            if (!items.length) return null;
            const open = collapsed || !!query || (expanded[group.label] ?? (index === 0 || group.items.some(item => isActive(item.href))));
            return (
            <div className="admin-nav-group" key={group.label}>
              {!collapsed && <button type="button" className="admin-nav-heading" aria-expanded={open} aria-controls={`admin-group-${index}`} onClick={() => setExpanded(value => ({ ...value, [group.label]: !open }))}>{group.label}<span aria-hidden="true">{open ? "−" : "+"}</span></button>}
              <div id={`admin-group-${index}`} hidden={!open}>{items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => { setMobileOpen(false); setQuery(''); }} className={`admin-nav-link ${active ? "is-active" : ""}`} aria-label={item.label} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 1.9} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}</div>
            </div>
          );})}
          {query && <button type="button" className="admin-search-reset" onClick={() => setQuery("")}>Сбросить поиск</button>}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/" onClick={() => setMobileOpen(false)} className="admin-site-link" aria-label="Вернуться на сайт" title={collapsed ? "На сайт" : undefined}>
            <ChevronLeft className="h-[18px] w-[18px]" />
            {!collapsed && <span>Вернуться на сайт</span>}
          </Link>
        </div>
      </aside>

      <nav className="admin-mobile-bottom-nav" aria-label="Быстрая навигация">
        {mobileItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`admin-mobile-bottom-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 1.9} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button type="button" className="admin-mobile-bottom-link" onClick={() => { setCollapsed(false); setMobileOpen(true); }} aria-expanded={mobileOpen} aria-controls="admin-navigation"><Menu size={19} /><span>Все разделы</span></button>
      </nav>
    </>
  );
}
