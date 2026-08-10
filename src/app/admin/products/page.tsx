"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Trash2, Edit3, Upload, X, Loader2, GripVertical, Package, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
    <div ref={setNodeRef} style={style} className={`bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 ${isDragging ? "shadow-xl ring-2 ring-teal-300" : "shadow-sm"}`}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded-lg hover:bg-gray-100 flex-shrink-0"><GripVertical className="w-4 h-4 text-gray-400" /></div>
      <div className="w-10 text-center flex-shrink-0"><span className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{formatOrder(product.sort_order || 0)}</span></div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {product.images?.[0] ? <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-gray-300" /></div>}
        <div className="min-w-0"><h3 className="font-semibold text-sm text-[#111827] truncate">{product.name}</h3><p className="text-xs text-[#6B7280]">{product.price} ₽ • Ост: {product.stock} • {product.category || "—"} / {product.subcategory || "—"}</p></div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(product)} className="p-2 rounded-xl bg-gray-50 text-[#6B7280] hover:bg-gray-100 transition-colors"><Edit3 className="w-4 h-4" /></button>
        <button onClick={() => onDelete(product.id)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
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
    const ids = products.map(p => p.id);
    await fetch("/api/admin/products/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    fetchProducts();
    toast.success("Порядок обновлён: 1, 2, 3...");
    setReordering(false);
  };

  const resetForm = () => {
    setName(""); setSlug(""); setDescription(""); setComposition(""); setPrice(""); setStock("0"); setVolume("");
    setImages([]); setCategory("care"); setSubcategory(""); setSortOrder(""); setEditId(null); setShowForm(false);
  };

  const editProduct = (p: Product) => {
    setEditId(p.id); setName(p.name); setSlug(p.slug);
    setDescription(p.description || ""); setComposition(p.composition || "");
    setPrice(String(p.price)); setStock(String(p.stock)); setVolume(String(p.volume_ml || ""));
    setImages(p.images || []); setCategory(p.category || "care"); setSubcategory(p.subcategory || "");
    setSortOrder(String(p.sort_order ?? "")); setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData(); fd.append("file", files[i]);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setImages(prev => [...prev, data.url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const url = editId ? `/api/admin/products?id=${editId}` : "/api/admin/products";
    const method = editId ? "PATCH" : "POST";
    await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, composition, price: Number(price), stock: Number(stock), volume_ml: volume ? Number(volume) : null, images, category, subcategory, sort_order: sortOrder ? Number(sortOrder) : null }),
    });
    resetForm(); fetchProducts(); toast.success(editId ? "Сохранено" : "Создано"); setSaving(false);
  };

  const deleteProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await fetch(`/api/admin/products?id=${id}`, { method: "DELETE" });
    fetchProducts(); toast.success("Удалено");
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
    await fetch("/api/admin/products/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: updated.map(p => p.id) }) });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-semibold text-[#111827]">Товары</h2><p className="text-sm text-[#6B7280] mt-1">Перетаскивайте или жмите «Упорядочить»</p></div>
        <div className="flex items-center gap-2">
          <button onClick={autoSort} disabled={reordering} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">
            {reordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />} Упорядочить
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0F766E] text-white text-sm font-medium hover:bg-[#0d6b63] transition-colors"><Plus className="w-4 h-4" /> Добавить</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveProduct} className="bg-white rounded-2xl p-6 border border-gray-100 mb-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Название" value={name} onChange={e => setName(e.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
            <input required placeholder="Slug" value={slug} onChange={e => setSlug(e.target.value)} className="h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-xs text-[#6B7280] mb-1">Категория</label><select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(""); }} className="w-full h-12 rounded-2xl border px-3 text-sm">{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><label className="block text-xs text-[#6B7280] mb-1">Подкатегория</label><select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full h-12 rounded-2xl border px-3 text-sm"><option value="">—</option>{SUBCATEGORIES[category]?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs text-[#6B7280] mb-1">Цена (₽)</label><input required type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full h-12 rounded-2xl border px-3 text-sm" /></div>
            <div><label className="block text-xs text-[#6B7280] mb-1">Порядок</label><input type="text" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full h-12 rounded-2xl border px-3 text-sm" placeholder="1 или 1.1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required type="number" placeholder="Остаток (шт)" value={stock} onChange={e => setStock(e.target.value)} className="h-12 rounded-2xl border px-3 text-sm" />
            <input type="number" placeholder="Объём (мл)" value={volume} onChange={e => setVolume(e.target.value)} className="h-12 rounded-2xl border px-3 text-sm" />
          </div>
          <textarea placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-2xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          <textarea placeholder="Состав" value={composition} onChange={e => setComposition(e.target.value)} rows={2} className="w-full rounded-2xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
          <div>
            <label className="block text-xs text-[#6B7280] mb-2">Фото</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map(url => (<div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden border"><img src={url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setImages(prev => prev.filter(u => u !== url))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></button></div>))}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-teal-400 transition-colors disabled:opacity-50">{uploading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <Upload className="w-5 h-5 text-gray-400" />}</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-full bg-[#0F766E] text-white font-medium hover:bg-[#0d6b63] transition-colors disabled:opacity-50">{saving ? "Сохранение..." : editId ? "Сохранить" : "Добавить товар"}</button>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={products.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {products.map(p => <SortableProductRow key={p.id} product={p} onEdit={editProduct} onDelete={deleteProduct} />)}
              {products.length === 0 && <p className="text-[#6B7280] text-center py-10">Нет товаров</p>}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
