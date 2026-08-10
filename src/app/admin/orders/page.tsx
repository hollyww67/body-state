"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { formatDistanceToNowStrict, format, isThisMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { RefreshCw, Truck, Check, Search, Package, Clock3, CreditCard, X as XIcon, Phone, MapPin, ChevronDown, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OrderItem { name: string; quantity: number; price: number; }
interface Order { id: string; client_name: string; client_phone: string; address: string; delivery: string; items: OrderItem[]; total: number; status: string; created_at: string; }

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "Ожидает оплаты", badge: "bg-amber-100 text-amber-700" },
  paid: { label: "Оплачен", badge: "bg-emerald-100 text-emerald-700" },
  shipped: { label: "Отправлен", badge: "bg-indigo-100 text-indigo-700" },
  delivered: { label: "Доставлен", badge: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Отменён", badge: "bg-red-100 text-red-600" },
};

const ACTIVE_COLUMNS = ["pending", "paid", "shipped", "delivered"];

function SortableOrder({ order, onOpen, onDelete }: { order: Order; onOpen: (o: Order) => void; onDelete?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: order.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isOverdue = order.status === "pending" && (Date.now() - new Date(order.created_at).getTime()) > 30 * 60 * 1000;
  const canDelete = order.status === "delivered" || order.status === "cancelled";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`bg-white rounded-2xl border p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md ${isDragging ? "shadow-xl z-50" : "shadow-sm"} ${isOverdue ? "border-l-2 border-l-red-400" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onOpen(order); }}>
          <p className="font-semibold text-sm text-[#111827] truncate hover:text-teal-600">{order.client_name}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">{formatDistanceToNowStrict(new Date(order.created_at), { locale: ru, addSuffix: true })}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <p className="text-base font-bold text-[#111827]">{order.total} ₽</p>
          {canDelete && onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(order.id); }} className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
      <p className="text-xs text-[#9CA3AF]">
        {order.items.length === 1 ? order.items[0].name : `${order.items[0]?.name} +${order.items.length - 1}`}
      </p>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchOrders = useCallback(async () => {
    try { setRefreshing(true); const res = await fetch("/api/admin/orders"); const data = await res.json(); setOrders(data.orders || []); }
    catch { toast.error("Не удалось загрузить"); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchOrders(); const i = setInterval(fetchOrders, 30000); return () => clearInterval(i); }, [fetchOrders]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    try { await fetch(`/api/admin/orders?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); }
    catch { fetchOrders(); }
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (id: string) => {
    setDeleting(true);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try { const res = await fetch(`/api/admin/orders?id=${id}`, { method: "DELETE" }); if (!res.ok) throw new Error(); toast.success("Удалён"); }
    catch { fetchOrders(); toast.error("Ошибка"); }
    finally { setDeleting(false); setShowDeleteConfirm(null); }
  }, [fetchOrders]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newStatus = over.id.toString();
    if (!ACTIVE_COLUMNS.includes(newStatus)) return;
    updateStatus(active.id.toString(), newStatus);
  }, [updateStatus]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      return o.client_name.toLowerCase().includes(q) || o.client_phone.includes(q) || o.address.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    });
  }, [orders, search]);

  const activeOrders = filteredOrders.filter(o => ACTIVE_COLUMNS.includes(o.status));
  const historyOrders = filteredOrders.filter(o => o.status === "cancelled" || o.status === "delivered");

  const stats = {
    total: orders.length,
    revenue: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0),
    revenueMonth: orders.filter((o) => o.status !== "cancelled" && isThisMonth(new Date(o.created_at))).reduce((sum, o) => sum + o.total, 0),
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => o.status === "paid").length,
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div><h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Заказы</h1><p className="text-sm text-[#6B7280] mt-1">Drag-and-drop для смены статуса</p></div>
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-[320px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..." className="w-full h-11 rounded-2xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" /></div>
              <button onClick={() => setShowHistory(!showHistory)} className={`h-11 px-4 rounded-2xl border text-sm font-medium transition-all flex items-center gap-2 ${showHistory ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200 hover:border-teal-200 hover:bg-teal-50"}`}>
                <History className="w-4 h-4" /> История ({historyOrders.length})
              </button>
              <button onClick={fetchOrders} className="h-11 px-4 rounded-2xl bg-white border border-gray-200 flex items-center gap-2 text-sm font-medium hover:border-teal-200 hover:bg-teal-50 transition-all"><RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />Обновить</button>
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mt-5">
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
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => (<div key={i} className="rounded-3xl bg-white border border-gray-100 p-4 space-y-3"><div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />{[...Array(3)].map((_, j) => (<div key={j} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />))}</div>))}</div>
        ) : showHistory ? (
          /* История */
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-lg text-[#111827] mb-4">История заказов</h3>
            {historyOrders.length === 0 ? (
              <div className="text-center py-10"><Package className="w-5 h-5 text-[#9CA3AF] mx-auto mb-2" /><p className="text-sm text-[#6B7280]">Нет завершённых заказов</p></div>
            ) : (
              <div className="space-y-2">
                {historyOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-gray-100">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDrawerOrder(order)}>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_CONFIG[order.status]?.badge}`}>{STATUS_CONFIG[order.status]?.label}</span>
                      <div>
                        <p className="font-medium text-sm text-[#111827]">{order.client_name}</p>
                        <p className="text-xs text-[#6B7280]">{format(new Date(order.created_at), "d MMMM, HH:mm", { locale: ru })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#111827]">{order.total} ₽</span>
                      <button onClick={() => setShowDeleteConfirm(order.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Канбан */
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
              {ACTIVE_COLUMNS.map((status) => {
                const columnOrders = activeOrders.filter((o) => o.status === status);
                return (
                  <SortableContext key={status} id={status} items={columnOrders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                    <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm">
                      <div className="flex items-center justify-between px-2 py-2 mb-3">
                        <div className="flex items-center gap-2"><h3 className="font-semibold text-sm text-[#111827]">{STATUS_CONFIG[status].label}</h3><span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-[#6B7280]">{columnOrders.length}</span></div>
                      </div>
                      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                        {columnOrders.map((order) => (<SortableOrder key={order.id} order={order} onOpen={setDrawerOrder} onDelete={(id) => setShowDeleteConfirm(id)} />))}
                        {columnOrders.length === 0 && (<div className="py-10 text-center"><Package className="w-5 h-5 text-[#9CA3AF] mx-auto mb-2" /><p className="text-sm text-[#6B7280]">Пусто</p></div>)}
                      </div>
                    </div>
                  </SortableContext>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
            <h3 className="text-lg font-semibold text-[#111827] mb-2">Удалить заказ?</h3>
            <p className="text-sm text-[#6B7280] mb-6">Это действие нельзя отменить.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-all">Отмена</button>
              <button onClick={() => deleteOrder(showDeleteConfirm)} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50">{deleting ? "Удаление..." : "Удалить"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOrder && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOrder(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-semibold text-[#111827]">Заказ #{drawerOrder.id.slice(0, 8)}</h2><button onClick={() => setDrawerOrder(null)} className="p-2 rounded-xl hover:bg-gray-100"><XIcon className="w-5 h-5" /></button></div>
              <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-lg font-bold text-[#111827]">{drawerOrder.client_name[0]}</div><div><p className="font-semibold text-[#111827]">{drawerOrder.client_name}</p><p className="text-sm text-[#6B7280]">{drawerOrder.client_phone}</p></div></div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm"><span className="text-[#6B7280]">Адрес</span><span className="font-medium text-right">{drawerOrder.address}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#6B7280]">Доставка</span><span className="font-medium">{drawerOrder.delivery === "cdek" ? "СДЭК" : drawerOrder.delivery === "pickup" ? "Самовывоз" : drawerOrder.delivery}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#6B7280]">Создан</span><span className="font-medium">{format(new Date(drawerOrder.created_at), "d MMMM, HH:mm", { locale: ru })}</span></div>
              </div>
              <div className="border-t pt-4 mb-6">
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">Товары</p>
                {drawerOrder.items.map((item, i) => (<div key={i} className="flex justify-between py-2 text-sm"><span>{item.name} × {item.quantity}</span><span className="font-medium">{item.price * item.quantity} ₽</span></div>))}
                <div className="flex justify-between pt-3 border-t mt-3 font-bold text-lg"><span>Итого</span><span>{drawerOrder.total} ₽</span></div>
              </div>
              {ACTIVE_COLUMNS.includes(drawerOrder.status) && (
                <div className="flex gap-2">
                  {drawerOrder.status === "pending" && <button onClick={() => { updateStatus(drawerOrder.id, "cancelled"); setDrawerOrder(null); }} className="flex-1 py-2.5 rounded-2xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100">Отменить</button>}
                  {drawerOrder.status === "paid" && <button onClick={() => { updateStatus(drawerOrder.id, "shipped"); setDrawerOrder(null); }} className="flex-1 py-2.5 rounded-2xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700">Отправить</button>}
                  {drawerOrder.status === "shipped" && <button onClick={() => { updateStatus(drawerOrder.id, "delivered"); setDrawerOrder(null); }} className="flex-1 py-2.5 rounded-2xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700">Доставлен</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, highlight }: { title: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${highlight ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"}`}>
      <div className="flex items-center justify-between"><div><p className="text-xs text-[#6B7280]">{title}</p><h3 className={`text-2xl font-bold mt-1 ${highlight ? "text-emerald-700" : "text-[#111827]"}`}>{value}</h3></div><div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${highlight ? "bg-emerald-100 text-emerald-700" : "bg-[#F3F4F6] text-[#111827]"}`}>{icon}</div></div>
    </div>
  );
}
