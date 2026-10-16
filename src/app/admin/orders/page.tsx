"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, format, isThisMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { RefreshCw, Check, Search, Package, Clock3, CreditCard, X as XIcon, Trash2, History, Link2 } from "lucide-react";
import { toast } from "sonner";
import AdminConfirmDialog, { AdminModal } from "@/components/admin/AdminConfirmDialog";
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminInput, AdminSkeleton, type BadgeTone } from "@/components/admin/ui";

interface OrderItem { name: string; quantity: number; price: number; }
interface Order { id: string; client_name: string; client_phone: string; address: string; delivery: string; items: OrderItem[]; total: number; status: string; created_at: string; payment_id?: string | null; paid_at?: string | null; amount_paid?: number | string | null; }

const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Ожидает оплаты", tone: "warning" },
  paid: { label: "Оплачен", tone: "success" },
  shipped: { label: "Отправлен", tone: "info" },
  delivered: { label: "Доставлен", tone: "neutral" },
  cancelled: { label: "Отменён", tone: "destructive" },
  failed: { label: "Ошибка оплаты", tone: "destructive" },
  refunded: { label: "Возвращён", tone: "neutral" },
};

const ACTIVE_COLUMNS = ["pending", "paid", "shipped", "delivered"];
const canDeleteOrder = (order: Order) => order.status === "cancelled" && !order.payment_id && !order.paid_at && Number(order.amount_paid || 0) === 0;

function OrderCard({ order, onOpen, onDelete }: { order: Order; onOpen: (o: Order) => void; onDelete?: (id: string) => void }) {
  const isOverdue = order.status === "pending" && (Date.now() - new Date(order.created_at).getTime()) > 30 * 60 * 1000;
  const canDelete = canDeleteOrder(order);

  return (
    <AdminCard className={`p-4 transition-shadow hover:shadow-[var(--bs-shadow-md)] ${isOverdue ? "border-l-2 border-l-[var(--bs-destructive)]" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <AdminButton type="button" variant="ghost" aria-label={`Открыть заказ ${order.client_name || order.id.slice(0, 8)}`} className="min-w-0 h-auto flex-col items-start text-left" onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onOpen(order); }}>
          <span className="max-w-full font-semibold text-sm text-[var(--bs-foreground)] truncate">{order.client_name}</span>
          <span className="text-xs text-[var(--bs-muted)] mt-0.5">{formatDistanceToNowStrict(new Date(order.created_at), { locale: ru, addSuffix: true })}</span>
        </AdminButton>
        <div className="flex items-center gap-1 shrink-0">
          <p className="text-base font-bold text-[var(--bs-foreground)]">{order.total} ₽</p>
          {canDelete && onDelete && (
            <AdminButton type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(order.id); }} className="text-[var(--bs-destructive)]" title="Удалить" aria-label={`Удалить заказ ${order.id.slice(0, 8)}`}><Trash2 className="w-3.5 h-3.5" /></AdminButton>
          )}
        </div>
      </div>
      <p className="text-xs text-[var(--bs-muted)]">
        {order.items.length === 0 ? "Состав заказа не указан" : order.items.length === 1 ? (order.items[0].name || "Платёж за услугу") : `${order.items[0]?.name || "Платёж"} и ещё ${order.items.length - 1}`}
      </p>
    </AdminCard>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const openedOrder = useRef(false);
  useEffect(() => {
    if (openedOrder.current || !orders.length) return;
    const id = new URLSearchParams(window.location.search).get("order");
    const order = orders.find(item => item.id === id);
    if (order) { setDrawerOrder(order); openedOrder.current = true; }
  }, [orders]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);


  const fetchOrders = useCallback(async () => {
    try { setRefreshing(true); const res = await fetch("/api/admin/orders"); const data = await res.json(); if (!res.ok) throw new Error(data.error); setOrders(data.orders || []); }
    catch { toast.error("Не удалось загрузить"); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchOrders(); const i = setInterval(fetchOrders, 30000); return () => clearInterval(i); }, [fetchOrders]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    try { const res = await fetch(`/api/admin/orders?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); const result = await res.json(); if (!res.ok) throw new Error(result.error || "Не удалось обновить статус"); }
    catch (error) { void fetchOrders(); toast.error(error instanceof Error ? error.message : "Ошибка обновления"); }
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Не удалось удалить заказ. Попробуйте ещё раз."); }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    toast.success("Удалён");
    void fetchOrders();
  }, [fetchOrders]);


  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      return o.client_name.toLowerCase().includes(q) || o.client_phone.includes(q) || o.address.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, search]);

  const activeOrders = filteredOrders.filter(o => ACTIVE_COLUMNS.includes(o.status));
  const historyOrders = filteredOrders.filter(o => ["cancelled", "delivered", "failed", "refunded"].includes(o.status));

  const paidStatuses = ["paid", "shipped", "delivered"];

  const stats = {
    total: orders.length,
    revenue: orders.filter((o) => paidStatuses.includes(o.status)).reduce((sum, o) => sum + o.total, 0),
    revenueMonth: orders.filter((o) => paidStatuses.includes(o.status) && isThisMonth(new Date(o.created_at))).reduce((sum, o) => sum + o.total, 0),
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => paidStatuses.includes(o.status)).length,
  };

  return (
    <div className="admin-orders-page min-h-screen bg-[var(--bs-background)] text-[var(--bs-foreground)]">
      <div className="sticky top-0 z-40 bg-[var(--bs-surface)] border-b border-[var(--bs-border)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div><h1 className="text-2xl font-semibold tracking-tight">Заказы</h1><p className="text-sm text-[var(--bs-muted)] mt-1">Нажмите на имя клиента, чтобы открыть заказ и действия с ним</p></div>
            <div className="admin-mobile-toolbar flex items-center gap-3">
              <div className="relative w-full sm:w-[320px]"><Search aria-hidden="true" className="pointer-events-none w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--bs-muted)]" /><AdminInput aria-label="Поиск заказов" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..." style={{ paddingLeft: "2.5rem" }} /></div>
              <Link href="/admin/payment-links" className="bs-button bs-button--primary bs-button--md whitespace-nowrap"><Link2 className="w-4 h-4" />Ссылка на оплату</Link>
              <AdminButton onClick={() => setShowHistory(!showHistory)} variant={showHistory ? "secondary" : "outline"} aria-pressed={showHistory}>
                <History className="w-4 h-4" /> История ({historyOrders.length})
              </AdminButton>
              <AdminButton onClick={fetchOrders} variant="outline"><RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />Обновить</AdminButton>
            </div>
          </div>
          <div className="admin-mobile-stats grid grid-cols-2 xl:grid-cols-5 gap-3 mt-5">
            <StatCard title="Всего заказов" value={stats.total} icon={<Package className="w-5 h-5" />} />
            <StatCard title="Ожидают" value={stats.pending} icon={<Clock3 className="w-5 h-5" />} />
            <StatCard title="Оплачено" value={stats.paid} icon={<CreditCard className="w-5 h-5" />} />
            <StatCard title="Выручка всего" value={`${stats.revenue.toLocaleString()} ₽`} icon={<Check className="w-5 h-5" />} />
            <StatCard title="Выручка за месяц" value={`${stats.revenueMonth.toLocaleString()} ₽`} icon={<Check className="w-5 h-5" />} highlight />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div role="status" aria-label="Загрузка заказов" className="grid grid-cols-1 xl:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => (<AdminCard key={i} className="p-4 space-y-3"><AdminSkeleton className="h-5 w-32" />{[...Array(3)].map((_, j) => (<AdminSkeleton key={j} className="h-20" />))}</AdminCard>))}</div>
        ) : showHistory ? (
          /* История */
          <AdminCard className="p-5">
            <h3 className="font-semibold text-lg mb-4">История заказов</h3>
            {historyOrders.length === 0 ? (
              <AdminEmptyState title="Нет завершённых заказов" />
            ) : (
              <div className="space-y-2">
                {historyOrders.map(order => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--bs-radius-card)] border border-[var(--bs-border)]">
                    <AdminButton type="button" variant="ghost" className="h-auto flex-wrap justify-start text-left" aria-label={`Открыть заказ ${order.id.slice(0, 8)} клиента ${order.client_name}`} onClick={() => setDrawerOrder(order)}>
                      <AdminBadge tone={STATUS_CONFIG[order.status]?.tone}>{STATUS_CONFIG[order.status]?.label}</AdminBadge>
                      <span>
                        <span className="block font-medium text-sm">{order.client_name}</span>
                        <span className="block text-xs text-[var(--bs-muted)]">{format(new Date(order.created_at), "d MMMM, HH:mm", { locale: ru })}</span>
                      </span>
                    </AdminButton>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.total} ₽</span>
                      {canDeleteOrder(order) && <AdminButton type="button" variant="ghost" size="icon" aria-label={`Удалить заказ ${order.id.slice(0, 8)}`} onClick={() => setShowDeleteConfirm(order.id)} className="text-[var(--bs-destructive)]"><Trash2 className="w-3.5 h-3.5" /></AdminButton>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        ) : (
          /* Канбан */
          <section aria-label="Заказы по этапам">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
              {ACTIVE_COLUMNS.map((status) => {
                const columnOrders = activeOrders.filter((o) => o.status === status);
                return (
                  <div key={status}>
                    <AdminCard className="p-3">
                      <div className="flex items-center justify-between px-2 py-2 mb-3">
                        <div className="flex items-center gap-2"><h3 className="font-semibold text-sm"><AdminBadge tone={STATUS_CONFIG[status].tone}>{STATUS_CONFIG[status].label}</AdminBadge></h3><span className="w-6 h-6 rounded-[var(--bs-radius-sm)] bg-[var(--bs-surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--bs-muted)]">{columnOrders.length}</span></div>
                      </div>
                      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                        {columnOrders.map((order) => (<OrderCard key={order.id} order={order} onOpen={setDrawerOrder} onDelete={(id) => setShowDeleteConfirm(id)} />))}
                        {columnOrders.length === 0 && <AdminEmptyState title="Пусто" />}
                      </div>
                    </AdminCard>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <AdminConfirmDialog title="Удалить заказ?" onCancel={() => setShowDeleteConfirm(null)} onConfirm={() => deleteOrder(showDeleteConfirm)}>
          <p>Это действие нельзя отменить.</p>
        </AdminConfirmDialog>
      )}

      {/* Drawer */}
      {drawerOrder && (
        <AdminModal title="Заказ" onCancel={() => setDrawerOrder(null)}>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[var(--bs-surface)] text-[var(--bs-foreground)] shadow-[var(--bs-shadow-md)] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-semibold">Заказ #{drawerOrder.id.slice(0, 8)}</h2><AdminButton type="button" variant="ghost" size="icon" aria-label="Закрыть карточку заказа" onClick={() => setDrawerOrder(null)}><XIcon className="w-5 h-5" /></AdminButton></div>
              <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 rounded-[var(--bs-radius-card)] bg-[var(--bs-surface-muted)] flex items-center justify-center text-lg font-bold">{drawerOrder.client_name[0]}</div><div><p className="font-semibold">{drawerOrder.client_name}</p><p className="text-sm text-[var(--bs-muted)]">{drawerOrder.client_phone}</p></div></div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm"><span className="text-[var(--bs-muted)]">Адрес</span><span className="font-medium text-right">{drawerOrder.address}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[var(--bs-muted)]">Доставка</span><span className="font-medium">{drawerOrder.delivery === "cdek" ? "СДЭК" : drawerOrder.delivery === "pickup" ? "Самовывоз" : drawerOrder.delivery}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[var(--bs-muted)]">Создан</span><span className="font-medium">{format(new Date(drawerOrder.created_at), "d MMMM, HH:mm", { locale: ru })}</span></div>
              </div>
              <div className="border-t border-[var(--bs-border)] pt-4 mb-6">
                <p className="text-xs font-semibold text-[var(--bs-muted)] uppercase tracking-wider mb-3">Товары</p>
                {drawerOrder.items.map((item, i) => (<div key={i} className="flex justify-between gap-3 py-2 text-sm"><span>{item.name || "Платёж за услугу"}{Number.isFinite(item.quantity) ? ` × ${item.quantity}` : ""}</span><span className="font-medium">{Number.isFinite(item.price * item.quantity) ? `${item.price * item.quantity} ₽` : "Сумма в итоге заказа"}</span></div>))}
                <div className="flex justify-between pt-3 border-t border-[var(--bs-border)] mt-3 font-bold text-lg"><span>Итого</span><span>{drawerOrder.total} ₽</span></div>
              </div>
              {ACTIVE_COLUMNS.includes(drawerOrder.status) && (
                <div className="flex gap-2">
                  {drawerOrder.status === "pending" && <AdminButton variant="destructive" onClick={() => { updateStatus(drawerOrder.id, "cancelled"); setDrawerOrder(null); }} className="flex-1">Отменить</AdminButton>}
                  {drawerOrder.status === "paid" && <AdminButton onClick={() => { updateStatus(drawerOrder.id, "shipped"); setDrawerOrder(null); }} className="flex-1">Отправить</AdminButton>}
                  {drawerOrder.status === "shipped" && <AdminButton onClick={() => { updateStatus(drawerOrder.id, "delivered"); setDrawerOrder(null); }} className="flex-1">Доставлен</AdminButton>}
                </div>
              )}
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, highlight }: { title: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <AdminCard className="p-4" style={highlight ? { background: "var(--bs-primary-soft)" } : undefined}>
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-[var(--bs-muted)]">{title}</p><h3 className="text-2xl font-bold mt-1 text-[var(--bs-foreground)]">{value}</h3></div><div className="w-11 h-11 shrink-0 rounded-[var(--bs-radius-card)] flex items-center justify-center bg-[var(--bs-surface-muted)] text-[var(--bs-primary)]">{icon}</div></div>
    </AdminCard>
  );
}
