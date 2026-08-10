"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  MessageSquare,
  ShoppingBag,
  Settings,
  Package,
  Menu,
  ChevronLeft,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Clock,
  LayoutDashboard,
  FileText,
  HeartPulse,
  Video,
  Image,
  Star,
} from "lucide-react";

const mainItems = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Календарь", icon: Calendar },
  { href: "/admin/bookings", label: "Заявки", icon: CalendarDays },
  { href: "/admin/slots", label: "Слоты", icon: Clock },
];

const storeItems = [
  { href: "/admin/orders", label: "Заказы", icon: Package },
  { href: "/admin/products", label: "Товары", icon: ShoppingBag },
  { href: "/admin/psychology", label: "Психология", icon: HeartPulse },
  { href: "/admin/pages", label: "Страницы", icon: FileText },
  { href: "/admin/reviews", label: "Отзывы", icon: Star },
  { href: "/admin/media", label: "До/После", icon: Image },
  { href: "/admin/faq", label: "FAQ бот", icon: MessageSquare },
  { href: "/admin/psychology-rooms", label: "Видео-комнаты", icon: Video },
  { href: "/admin/settings", label: "Тема", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-sm">Админка</span>
        </div>
        <div className="w-8" />
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-gradient-to-b from-white to-slate-50/80 backdrop-blur-2xl border-r border-slate-200/60 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] flex flex-col transition-all duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "w-[80px]" : "w-[280px]"}`}
      >
        <div
          className={`flex items-center p-5 ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-[15px] tracking-tight">
                Админка
              </p>
              <p className="text-xs text-slate-500">Через тело к состоянию</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-8 h-8 rounded-xl bg-slate-100 hover:bg-white border border-slate-200 shadow-sm items-center justify-center flex-shrink-0 ml-auto transition-all hover:shadow-md"
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronsLeft className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 px-4 overflow-y-auto">
          {!collapsed && (
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-3 mt-2 mb-1">
              Основное
            </p>
          )}
          {mainItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[15px] font-medium transition-all duration-200 group ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20"
                    : "text-slate-600 hover:bg-slate-100/80 hover:translate-x-0.5"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active
                      ? "text-white"
                      : "opacity-70 group-hover:opacity-100"
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {!collapsed && (
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-3 mt-4 mb-1">
              Магазин и контент
            </p>
          )}
          {storeItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[15px] font-medium transition-all duration-200 group ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20"
                    : "text-slate-600 hover:bg-slate-100/80 hover:translate-x-0.5"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active
                      ? "text-white"
                      : "opacity-70 group-hover:opacity-100"
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4 pt-2 border-t border-slate-200/60">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[15px] font-medium text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 transition-all duration-200 ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "На сайт" : undefined}
          >
            <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            {!collapsed && "На сайт"}
          </Link>
        </div>
      </aside>
    </>
  );
}
