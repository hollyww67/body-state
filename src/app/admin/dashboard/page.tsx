"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Calendar, ClipboardList, Clock, ShoppingBag,
  Package, FileText, MessageSquare, Palette, LogOut, Star
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    pendingBookings: 0,
    pendingOrders: 0,
    pendingReviews: 0,
    totalProducts: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = async () => {
    const res = await fetch("/api/admin/check-auth");
    if (!res.ok) {
      router.push("/login");
    }
  };

  const loadStats = async () => {
    // Здесь будут реальные запросы к Supabase
    // Пока заглушка
    setStats({
      pendingBookings: 0,
      pendingOrders: 0,
      pendingReviews: 0,
      totalProducts: 0,
    });
  };

  const menuItems = [
    { icon: Calendar, label: "Календарь", href: "/admin/calendar", color: "#0F766E" },
    { icon: ClipboardList, label: "Заявки", href: "/admin/bookings", color: "#14B8A6" },
    { icon: Clock, label: "Слоты", href: "/admin/slots", color: "#6366F1" },
    { icon: ShoppingBag, label: "Заказы", href: "/admin/orders", color: "#F59E0B" },
    { icon: Package, label: "Товары", href: "/admin/products", color: "#EC4899" },
    { icon: FileText, label: "Страницы", href: "/admin/pages", color: "#8B5CF6" },
    { icon: MessageSquare, label: "FAQ", href: "/admin/faq", color: "#3B82F6" },
    { icon: Star, label: "Отзывы", href: "/admin/reviews", color: "#E7CFA4" },
    { icon: Palette, label: "Тема", href: "/admin/settings", color: "#EF4444" },
  ];

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Дашборд
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            Управление сайтом
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground-secondary)' }}
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>

      {/* Быстрые карточки */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-feature rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-secondary)' }}>Заявки</span>
          </div>
          <p className="text-2xl font-semibold text-amber-400">{stats.pendingBookings}</p>
        </div>
        <div className="glass-feature rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-secondary)' }}>Заказы</span>
          </div>
          <p className="text-2xl font-semibold text-blue-400">{stats.pendingOrders}</p>
        </div>
        <div className="glass-feature rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-secondary)' }}>Отзывы</span>
          </div>
          <p className="text-2xl font-semibold text-amber-400">{stats.pendingReviews}</p>
        </div>
        <div className="glass-feature rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-secondary)' }}>Товары</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">{stats.totalProducts}</p>
        </div>
      </div>

      {/* Меню */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="glass-feature rounded-2xl p-5 hover:-translate-y-0.5 transition-all group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {item.label}
              </h2>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
