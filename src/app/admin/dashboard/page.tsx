"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminToday from '@/components/admin/AdminToday';
import HealthcareMiniCalendar from '@/components/admin/HealthcareMiniCalendar';
import {
  AlertCircle, ArrowRight, CalendarDays, Clock3, Package, RefreshCw,
  Plus, ShoppingBag, Star, TrendingUp, UserRound,
} from "lucide-react";

type Booking = {
  id: string;
  client_name: string;
  service_type: string;
  status: string;
  created_at: string;
  slot_time?: string | null;
};

type Order = {
  id: string;
  client_name: string;
  status: string;
  total: number;
  created_at: string;
};

type Product = { id: string; stock: number };
type Review = { id: string };

const serviceLabels: Record<string, string> = {
  bfm: "Физическая реабилитация",
  brt: "БРТ",
  psychology: "Психологическая реабилитация",
  program: "Программа",
  consultation: "Консультация",
};

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  new: "Новая",
  confirmed: "Подтверждена",
  paid: "Оплачен",
  shipped: "Отправлен",
  completed: "Завершена",
  delivered: "Доставлен",
  cancelled: "Отменён",
  refunded: "Возврат выполнен",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(false);
    try {
      const responses = await Promise.all([
        fetch("/api/admin/bookings", { cache: "no-store" }),
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/reviews", { cache: "no-store" }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("Dashboard request failed");
      const [bookingData, orderData, productData, reviewData] = await Promise.all(responses.map((response) => response.json()));
      setBookings(bookingData.bookings || []);
      setOrders(orderData.orders || []);
      setProducts(productData.products || []);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => ({
    pendingBookings: bookings.filter((item) => ["pending", "new"].includes(item.status)).length,
    activeOrders: orders.filter((item) => ["pending", "paid", "shipped"].includes(item.status)).length,
    lowStock: products.filter((item) => item.stock <= 5).length,
    reviews: reviews.length,
    revenue: orders.filter((item) => ["paid", "shipped", "delivered"].includes(item.status)).reduce((sum, item) => sum + Number(item.total || 0), 0),
  }), [bookings, orders, products, reviews]);

  const upcomingBookings = bookings.filter(item => item.status === "confirmed" && item.slot_time && new Date(item.slot_time).getTime() >= Date.now()).sort((a, b) => new Date(a.slot_time!).getTime() - new Date(b.slot_time!).getTime()).slice(0, 3);

  const cards = [
    { label: "Ожидают действий", value: stats.pendingBookings, detail: `${bookings.length} записей всего`, href: "/admin/bookings", icon: CalendarDays, tone: "teal" },
    { label: "Активные заказы", value: stats.activeOrders, detail: `${orders.length} всего`, href: "/admin/orders", icon: ShoppingBag, tone: "blue" },
    { label: "Мало на складе", value: stats.lowStock, detail: `${products.length} товаров`, href: "/admin/products", icon: Package, tone: "amber" },
    { label: "Отзывы", value: stats.reviews, detail: "Опубликовано", href: "/admin/reviews", icon: Star, tone: "violet" },
  ];

  return (
    <div className="admin-dashboard admin-dashboard-v2 healthcare-dashboard">
      <div className="healthcare-workgrid">
      <div className="healthcare-main">
      <header className="admin-dashboard-intro admin-dashboard-welcome">
        <div>
          <h2>Здравствуйте!</h2>
          <p>Вот что происходит в Body State сегодня.</p>
        </div>
        <button type="button" aria-label="Обновить общую сводку" onClick={() => loadData(true)} className="admin-dashboard-refresh" disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>Обновить</span>
        </button>
      </header>

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <AlertCircle className="h-4 w-4" /> Не удалось обновить сводку. Показатели могут быть устаревшими. Нажмите «Обновить» и попробуйте ещё раз.
        </div>
      )}

      <section className="admin-stat-grid" aria-label="Основные показатели">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link href={card.href} className="admin-stat-card" key={card.label}>
              <span className={`admin-stat-icon is-${card.tone}`}><Icon className="h-5 w-5" /></span>
              <div><p>{card.label}</p><strong>{loading || error ? "—" : card.value}</strong><small>{loading ? "Загрузка…" : error ? "Не удалось обновить" : card.detail}</small></div>
              <ArrowRight className="admin-stat-arrow h-4 w-4" />
            </Link>
          );
        })}
      </section>

          <div className="admin-dashboard-day">
            <AdminToday />
          </div>

      <section className="admin-dashboard-grid admin-dashboard-recent" aria-label="Последние записи и заказы">
        <DashboardList title="Последние заказы" href="/admin/orders" empty={loading ? "Загружаем заказы…" : error ? "Данные недоступны. Повторите обновление." : "Заказов пока нет"}>
          {orders.slice(0, 5).map((order) => (
            <Link href={`/admin/orders?order=${order.id}`} className="admin-activity-row" key={order.id}>
              <span className="admin-activity-avatar is-order"><ShoppingBag className="h-4 w-4" /></span>
              <span className="admin-activity-copy">
                <strong>{order.client_name || `Заказ #${order.id.slice(0, 6)}`}</strong>
                <small>{formatDate(order.created_at)}</small>
              </span>
              <span className="admin-order-meta"><strong>{Number(order.total || 0).toLocaleString("ru-RU")} ₽</strong><StatusBadge status={order.status} /></span>
            </Link>
          ))}
        </DashboardList>
      <section className="admin-revenue-card healthcare-revenue">
        <span className="admin-revenue-icon"><TrendingUp className="h-5 w-5" /></span>
        <div><p>Выручка · оплаченные заказы</p><strong>{loading || error ? "—" : `${stats.revenue.toLocaleString("ru-RU")} ₽`}</strong></div>
        <div className="admin-revenue-note"><Clock3 className="h-4 w-4" /> За всё время</div>
        <p className="healthcare-revenue-caption">Сумма заказов в статусах «Оплачен», «Отправлен» и «Доставлен».</p>
      </section>
      </section>

        </div>

        <aside className="admin-dashboard-sidebar" aria-label="Действия и ближайшие приёмы">
      <HealthcareMiniCalendar />
      <section className="admin-quick-actions admin-dashboard-actions" aria-label="Быстрые действия">
        <div><p className="admin-section-eyebrow">Каждый день</p><h3>Быстрые действия</h3></div>
        <div className="admin-quick-action-list">
          <Link href="/admin/bookings?create=1" className="admin-quick-action is-primary"><Plus className="h-4 w-4" /><span>Новая запись</span></Link>
          <Link href="/admin/bookings" className="admin-quick-action"><UserRound className="h-4 w-4" /><span>Найти клиента</span></Link>
          <Link href="/admin/slots" className="admin-quick-action"><CalendarDays className="h-4 w-4" /><span>Расписание</span></Link>
          <Link href="/admin/payment-links" className="admin-quick-action"><ShoppingBag className="h-4 w-4" /><span>Ссылка на оплату</span></Link>
        </div>
      </section>

      <section className="admin-next-card">
        <div className="admin-next-heading"><span className="admin-section-eyebrow">Ближайшие подтверждённые приёмы</span><Link href="/admin/calendar">Весь календарь <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        {upcomingBookings.map((booking) => (
          <Link href={`/admin/bookings?booking=${booking.id}`} className="admin-next-row" key={`next-${booking.id}`}>
            <span className="admin-next-time">{formatTime(booking.slot_time)}</span>
            <span className="admin-next-line" />
            <span className="admin-activity-copy"><strong>{booking.client_name || "Без имени"}</strong><small>{formatDate(booking.slot_time)} · {serviceLabels[booking.service_type] || booking.service_type}</small></span>
            <ArrowRight className="h-4 w-4 text-[var(--admin-muted)]" />
          </Link>
        ))}
        {loading ? <p className="admin-list-empty">Загружаем приёмы…</p> : error ? <p className="admin-list-empty">Не удалось обновить приёмы</p> : upcomingBookings.length === 0 && <p className="admin-list-empty">Будущих подтверждённых приёмов нет</p>}
      </section>

        </aside>
      </div>
    </div>
  );
}

function DashboardList({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <article className="admin-list-card">
      <header><h3>{title}</h3><Link href={href}>Все <ArrowRight className="h-3.5 w-3.5" /></Link></header>
      <div>{hasChildren ? children : <p className="admin-list-empty">{empty}</p>}</div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`admin-status-badge is-${status}`}>{statusLabels[status] || status}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "Дата не указана";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата не указана" : dateFormatter.format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
}
