"use client";
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

import SiteImage from '@/components/SiteImage';
import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Trash2, Edit3, Upload, X, Loader2, GripVertical, Package, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminBadge, AdminButton, AdminCheckbox, AdminInput, AdminSelect, AdminSkeleton, AdminTextarea } from "@/components/admin/ui";

interface Product {
  id: string; slug: string; name: string; description: string; composition?: string;
  price: number; stock: number; volume_ml?: number; images: string[];
  is_active: boolean; category: string; subcategory: string; sort_order: number;
}

const CATEGORIES = [
  { value: "care", label: "Уход" },
  { value: "health", label: "Здоровье" },
  { value: "aroma", label: "Арома" },
];
const SUBCATEGORIES: Record<string, string[]> = {
  care: ["Для волос", "Для лица", "Для тела", "Полости рта"],
  health: ["Лор", "Личная гигиена Ж", "Личная гигиена М"],
  aroma: ["Ингаляторы", "Умный воротничок", "Духи"],
};

function formatOrder(n: number): string {
  const major = Math.floor(n);
  const minor = Math.round((n - major) * 10);
  return minor > 0 ? `${major}.${minor}` : `${major}`;
}

function SortableProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: (p: Product) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };

  return (
    <div ref={setNodeRef} style={style} className={`bs-card p-4 flex flex-wrap items-center gap-3 ${isDragging ? "shadow-xl ring-2 ring-[var(--bs-primary)]" : ""}`}>
      <div {...attributes} {...listeners} aria-label={`Переместить ${product.name}`} className="cursor-grab active:cursor-grabbing min-h-11 min-w-11 flex items-center justify-center rounded-[var(--bs-radius-control)] hover:bg-[var(--bs-surface-muted)] flex-shrink-0"><GripVertical className="w-4 h-4 text-[var(--bs-muted)]" /></div>
      <div className="w-10 text-center flex-shrink-0"><span className="text-xs font-mono text-[var(--bs-muted)] bg-[var(--bs-surface-muted)] rounded px-1.5 py-0.5">{formatOrder(product.sort_order || 0)}</span></div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {product.images?.[0] ? <SiteImage src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-[var(--bs-surface-muted)] flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-[var(--bs-muted)]" /></div>}
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-sm text-[var(--bs-foreground)] truncate">{product.name}</h3>{!product.is_active && <AdminBadge tone="warning">Скрыт</AdminBadge>}</div><p className="text-xs text-[var(--bs-muted)]">{product.price} ₽ • Ост: {product.stock} • {product.category || "—"} / {product.subcategory || "—"}</p></div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <AdminButton type="button" variant="ghost" size="icon" aria-label={`Редактировать ${product.name}`} onClick={() => onEdit(product)}><Edit3 className="w-4 h-4" /></AdminButton>
        <AdminButton type="button" variant="destructive" size="icon" aria-label={`Удалить ${product.name}`} onClick={() => onDelete(product.id)}><Trash2 className="w-4 h-4" /></AdminButton>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(""); const [composition, setComposition] = useState("");
  const [price, setPrice] = useState(""); const [stock, setStock] = useState("0");
  const [volume, setVolume] = useState(""); const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState("care"); const [subcategory, setSubcategory] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchProducts = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/products").then(r => r.json()).then(d => {
      setProducts((d.products || []).sort((a: Product, b: Product) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const autoSort = async () => {
    setReordering(true);
    try {
      const ids = products.map(p => p.id);
      const response = await fetch("/api/admin/products/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("Не удалось сохранить порядок");
      fetchProducts();
      toast.success("Порядок обновлён: 1, 2, 3...");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить порядок");
    } finally {
      setReordering(false);
    }
  };

  const resetForm = () => {
    setName(""); setSlug(""); setDescription(""); setComposition(""); setPrice(""); setStock("0"); setVolume("");
    setImages([]); setCategory("care"); setSubcategory(""); setSortOrder(""); setIsActive(true); setEditId(null); setShowForm(false);
  };

  const editProduct = (p: Product) => {
    setEditId(p.id); setName(p.name); setSlug(p.slug);
    setDescription(p.description || ""); setComposition(p.composition || "");
    setPrice(String(p.price)); setStock(String(p.stock)); setVolume(String(p.volume_ml || ""));
    setImages(p.images || []); setCategory(p.category || "care"); setSubcategory(p.subcategory || "");
    setSortOrder(String(p.sort_order ?? "")); setIsActive(p.is_active !== false); setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData(); fd.append("file", files[i]);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || `Не удалось загрузить ${files[i].name}`);
        continue;
      }
      setImages(prev => [...prev, data.url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const url = editId ? `/api/admin/products?id=${editId}` : "/api/admin/products";
    const method = editId ? "PATCH" : "POST";
    try {
      const response = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description, composition, price: Number(price), stock: Number(stock), volume_ml: volume ? Number(volume) : null, images, category, subcategory, sort_order: sortOrder ? Number(sortOrder) : null, is_active: isActive }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить товар");
      toast.success(editId ? "Сохранено" : "Создано");
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось удалить товар");
      setProducts(prev => prev.filter(item => item.id !== id));
      toast.success("Удалено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить товар");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex(p => p.id === active.id);
    const newIndex = products.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...products];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
    setProducts(updated);
    const response = await fetch("/api/admin/products/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: updated.map(p => p.id) }) });
    if (!response.ok) {
      toast.error("Не удалось сохранить порядок");
      fetchProducts();
    }
  };

  return (
    <div className="admin-products-page max-w-5xl mx-auto">
      {deleteTarget && <AdminConfirmDialog title={`Удалить товар «${deleteTarget.name || "Без названия"}»?`} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteProduct(deleteTarget.id)}><p>{deleteTarget.name || "Без названия"}</p></AdminConfirmDialog>}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div><h2 className="text-2xl font-semibold text-[var(--bs-foreground)]">Товары</h2><p className="text-sm text-[var(--bs-muted)] mt-1">Перетаскивайте или жмите «Упорядочить»</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton type="button" variant="secondary" onClick={autoSort} disabled={reordering}>
            {reordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />} Упорядочить
          </AdminButton>
          <AdminButton type="button" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> Добавить</AdminButton>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveProduct} className="bs-card p-4 md:p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminInput aria-label="Название" required placeholder="Название" value={name} onChange={e => setName(e.target.value)} />
            <AdminInput aria-label="Slug" required placeholder="Slug" value={slug} onChange={e => setSlug(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label htmlFor="product-category" className="block text-xs text-[var(--bs-muted)] mb-1">Категория</label><AdminSelect id="product-category" value={category} onChange={e => { setCategory(e.target.value); setSubcategory(""); }}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</AdminSelect></div>
            <div><label htmlFor="product-subcategory" className="block text-xs text-[var(--bs-muted)] mb-1">Подкатегория</label><AdminSelect id="product-subcategory" value={subcategory} onChange={e => setSubcategory(e.target.value)}><option value="">—</option>{SUBCATEGORIES[category]?.map(s => <option key={s} value={s}>{s}</option>)}</AdminSelect></div>
            <div><label htmlFor="product-price" className="block text-xs text-[var(--bs-muted)] mb-1">Цена (₽)</label><AdminInput id="product-price" required type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><label htmlFor="product-order" className="block text-xs text-[var(--bs-muted)] mb-1">Порядок</label><AdminInput id="product-order" type="text" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="1 или 1.1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AdminInput aria-label="Остаток (шт)" required type="number" placeholder="Остаток (шт)" value={stock} onChange={e => setStock(e.target.value)} />
            <AdminInput aria-label="Объём (мл)" type="number" placeholder="Объём (мл)" value={volume} onChange={e => setVolume(e.target.value)} />
          </div>
          <AdminTextarea aria-label="Описание" placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none" />
          <AdminTextarea aria-label="Состав" placeholder="Состав" value={composition} onChange={e => setComposition(e.target.value)} rows={2} className="resize-none" />
          <label className="flex items-center gap-3 rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] px-4 py-3 text-sm text-[var(--bs-foreground)]">
            <AdminCheckbox checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Показывать товар в магазине и разрешать оплату
          </label>
          <div>
            <label className="block text-xs text-[var(--bs-muted)] mb-2">Фото</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map(url => (<div key={url} className="relative w-24 h-24 rounded-[var(--bs-radius-card)] overflow-hidden border border-[var(--bs-border)]"><SiteImage src={url} alt="" className="w-full h-full object-cover" /><AdminButton type="button" variant="destructive" size="icon" aria-label="Удалить фото" onClick={() => setImages(prev => prev.filter(u => u !== url))} className="absolute top-0.5 right-0.5"><X className="w-4 h-4" /></AdminButton></div>))}
              <AdminButton type="button" variant="outline" aria-label="Загрузить фото" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-24 h-24 border-dashed">{uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}</AdminButton>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
          <AdminButton type="submit" disabled={saving} className="w-full">{saving ? "Сохранение..." : editId ? "Сохранить" : "Добавить товар"}</AdminButton>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <AdminSkeleton key={i} className="h-16" />)}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={products.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {products.map(p => <SortableProductRow key={p.id} product={p} onEdit={editProduct} onDelete={id => setDeleteTarget({ id, name: products.find(item => item.id === id)?.name || "Без названия" })} />)}
              {products.length === 0 && <p className="text-[var(--bs-muted)] text-center py-10">Нет товаров</p>}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
