"use client";

import SiteImage from '@/components/SiteImage';
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { Store, Plus, Minus, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, TrendingUp, ArrowUp, ArrowDown, ListOrdered, Sparkles } from "lucide-react";
import { usePageCopy } from "@/lib/hooks/use-page-copy";

interface Product {
  id: string; slug: string; name: string; description: string; price: number;
  stock: number; images: string[]; category: string; subcategory: string; sort_order: number;
  popularity: number;
}
interface CartItem { productId: string; slug: string; name: string; price: number; image: string | null; quantity: number; }

const CATEGORIES: Record<string, { label: string; subcategories: string[] }> = {
  all: { label: "Все товары", subcategories: [] },
  care: { label: "Уход", subcategories: ["Для волос", "Для лица", "Для тела", "Полости рта"] },
  health: { label: "Здоровье", subcategories: ["Лор", "Личная гигиена Ж", "Личная гигиена М"] },
  aroma: { label: "Арома", subcategories: ["Ингаляторы", "Умный воротничок", "Духи"] },
};

type SortMode = "order" | "popular" | "price_asc" | "price_desc";

function ProductImages({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);
  if (!images?.length) return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50">
      <Image src="/logo.png" alt={name} width={80} height={80} className="opacity-40 rounded-2xl" unoptimized />
    </div>
  );
  return (
    <div className="relative w-full h-full group">
      <SiteImage src={images[current]} alt={`${name} ${current+1}`} className="w-full h-full object-cover" loading="lazy" />
      {images.length>1&&(<>
        <button onClick={e=>{e.preventDefault();e.stopPropagation();setCurrent(c=>c===0?images.length-1:c-1)}} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-4 h-4 text-gray-700"/></button>
        <button onClick={e=>{e.preventDefault();e.stopPropagation();setCurrent(c=>c===images.length-1?0:c+1)}} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4 text-gray-700"/></button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {images.map((_,i)=>(<button key={i} onClick={e=>{e.preventDefault();e.stopPropagation();setCurrent(i)}} className={`w-1.5 h-1.5 rounded-full transition-all ${i===current?"bg-white w-3":"bg-white/60"}`}/>))}
        </div>
      </>)}
    </div>
  );
}

export default function ShopPage() {
  const copy = usePageCopy("shop");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("order");
  const [addedProduct, setAddedProduct] = useState<Product | null>(null);

  const loadCart = useCallback(() => setCart(JSON.parse(localStorage.getItem("cart") || "[]")), []);
  useEffect(() => {
    fetch("/api/products").then(r=>r.json()).then(d=>{
      setProducts(d.products||[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
    loadCart();
    window.addEventListener("cartUpdated",loadCart);
    return ()=>window.removeEventListener("cartUpdated",loadCart);
  }, [loadCart]);

  const filtered = products.filter(p => {
    if (search.trim()) { const q=search.toLowerCase(); if(!p.name.toLowerCase().includes(q)&&!p.description?.toLowerCase().includes(q)) return false; }
    if (activeCategory==="all") return true;
    if (activeSubcategory) return p.subcategory===activeSubcategory;
    return p.category===activeCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "order") return (a.sort_order ?? 999) - (b.sort_order ?? 999);
    if (sortMode === "popular") return (b.popularity ?? 0) - (a.popularity ?? 0);
    if (sortMode === "price_asc") return a.price - b.price;
    if (sortMode === "price_desc") return b.price - a.price;
    return 0;
  });

  const getCartQty = (id: string) => cart.find(i=>i.productId===id)?.quantity || 0;
  const updateCart = (p: Product, d: number) => {
    const ex = JSON.parse(localStorage.getItem("cart")||"[]") as CartItem[];
    const idx = ex.findIndex(i=>i.productId===p.id);
    if (idx>=0) { const q=ex[idx].quantity+d; if(q<=0) ex.splice(idx,1); else ex[idx].quantity=q; }
    else if(d>0) { ex.push({productId:p.id,slug:p.slug,name:p.name,price:p.price,image:p.images?.[0]||null,quantity:d}); setAddedProduct(p); setTimeout(()=>setAddedProduct(null),4000); }
    localStorage.setItem("cart",JSON.stringify(ex)); setCart(ex); window.dispatchEvent(new Event("cartUpdated"));
  };

  const relatedProducts = addedProduct
    ? products.filter(p => p.category === addedProduct.category && p.id !== addedProduct.id && p.stock > 0).slice(0, 3)
    : [];

  return (
    <main className="page-shell shop-shell">
      <Navbar />
      <section className="page-hero pb-8 lg:pb-10">
        <div className="page-hero-inner">
          <div className="page-kicker mb-6 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}><Sparkles className="h-4 w-4" />{copy.eyebrow}</div>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div><h1 className="page-title text-5xl font-semibold leading-[1.02] md:text-6xl" style={{ color: 'var(--foreground)' }}>{copy.title}</h1><p className="page-lead mt-6 text-lg leading-8" style={{ color: 'var(--foreground-secondary)' }}>{copy.lead}</p></div>
            <div className="content-panel rounded-2xl px-5 py-4 text-sm" style={{ color: 'var(--foreground-secondary)' }}>{products.length > 0 ? `${products.length} товаров в каталоге` : 'Каталог обновляется'}</div>
          </div>
        </div>
      </section>
      <div className="lg:hidden sticky top-[68px] z-20 px-3 py-3" style={{ background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(18px)' }}>
        <button onClick={() => setSidebarOpen(true)} className="shop-surface w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border text-sm font-medium shadow-sm">
          <SlidersHorizontal className="w-4 h-4" /> Категории {activeCategory !== "all" ? `• ${CATEGORIES[activeCategory]?.label}` : ""}
        </button>
        <div className="relative mt-2"><Search className="shop-muted absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" /><input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="shop-surface w-full h-10 pl-10 pr-4 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" /></div>
      </div>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-16">
        <div className="flex gap-6">
          <aside className="hidden lg:block w-[240px] flex-shrink-0">
            <div className="sticky top-[120px] space-y-5">
              <div className="relative"><Search className="shop-muted absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" /><input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="shop-surface w-full h-11 pl-10 pr-4 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" /></div>
              <div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Категории</h3><div className="space-y-1">{Object.entries(CATEGORIES).map(([key, cat]) => (<button key={key} onClick={() => { setActiveCategory(key); setActiveSubcategory(null); }} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeCategory===key&&!activeSubcategory?"text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`} style={activeCategory===key&&!activeSubcategory?{background:'var(--primary)'}:{}}>{cat.label}</button>))}</div></div>
              {activeCategory!=="all"&&CATEGORIES[activeCategory]?.subcategories.length>0&&(<div><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Подкатегории</h3><div className="space-y-1"><button onClick={()=>setActiveSubcategory(null)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${!activeSubcategory?"text-white shadow-sm":"text-gray-500 hover:bg-gray-100"}`} style={!activeSubcategory?{background:'var(--primary)'}:{}}>Все в {CATEGORIES[activeCategory].label}</button>{CATEGORIES[activeCategory].subcategories.map(sub=>(<button key={sub} onClick={()=>setActiveSubcategory(sub)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeSubcategory===sub?"text-white shadow-sm":"text-gray-500 hover:bg-gray-100"}`} style={activeSubcategory===sub?{background:'var(--primary)'}:{}}>{sub}</button>))}</div></div>)}
            </div>
          </aside>
          {sidebarOpen && (<div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={()=>setSidebarOpen(false)}/><div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-2xl p-5 overflow-y-auto"><div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-[#111827]">Категории</h3><button onClick={()=>setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button></div><div className="space-y-1 mb-6">{Object.entries(CATEGORIES).map(([key,cat])=>(<button key={key} onClick={()=>{setActiveCategory(key);setActiveSubcategory(null);setSidebarOpen(false)}} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeCategory===key&&!activeSubcategory?"text-white":"text-gray-600 hover:bg-gray-100"}`} style={activeCategory===key&&!activeSubcategory?{background:'var(--primary)'}:{}}>{cat.label}</button>))}</div>{activeCategory!=="all"&&CATEGORIES[activeCategory]?.subcategories.length>0&&(<div className="space-y-1"><button onClick={()=>{setActiveSubcategory(null);setSidebarOpen(false)}} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${!activeSubcategory?"text-white":"text-gray-500 hover:bg-gray-100"}`} style={!activeSubcategory?{background:'var(--primary)'}:{}}>Все в {CATEGORIES[activeCategory].label}</button>{CATEGORIES[activeCategory].subcategories.map(sub=>(<button key={sub} onClick={()=>{setActiveSubcategory(sub);setSidebarOpen(false)}} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSubcategory===sub?"text-white":"text-gray-500 hover:bg-gray-100"}`} style={activeSubcategory===sub?{background:'var(--primary)'}:{}}>{sub}</button>))}</div>)}</div></div>)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-gray-400 mr-1">Сортировка:</span>
              {[{ mode: "order" as SortMode, label: "По порядку", icon: <ListOrdered className="w-3 h-3" /> },{ mode: "popular" as SortMode, label: "Популярные", icon: <TrendingUp className="w-3 h-3" /> },{ mode: "price_asc" as SortMode, label: "По возрастанию", icon: <ArrowUp className="w-3 h-3" /> },{ mode: "price_desc" as SortMode, label: "По убыванию", icon: <ArrowDown className="w-3 h-3" /> }].map(s => (<button key={s.mode} onClick={() => setSortMode(s.mode)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${sortMode===s.mode?"bg-[var(--primary)] text-white":"bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{s.icon}{s.label}</button>))}
            </div>
            {loading?(<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{[...Array(8)].map((_,i)=>(<div key={i} className="shop-card rounded-[24px] overflow-hidden animate-pulse"><div className="shop-image aspect-square"/><div className="p-4 space-y-3"><div className="h-3 rounded w-3/4" style={{background:'var(--primary-muted)'}}/><div className="h-4 rounded w-1/2" style={{background:'var(--primary-muted)'}}/></div></div>))}</div>):sorted.length===0?(<div className="content-panel rounded-[32px] text-center py-20">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--primary-muted)' }}>
                  <Store className="w-10 h-10" style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{copy.emptyTitle}</h2>
                <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--foreground-secondary)' }}>{copy.emptyText}</p>
              </div>):(<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{sorted.map(product=>{const qty=getCartQty(product.id);const out=product.stock===0;return(<div key={product.id} className="shop-card rounded-[24px] overflow-hidden transition-all flex flex-col"><Link href={`/shop/${product.slug}`} className="shop-image block relative aspect-square"><ProductImages images={product.images} name={product.name} />{out&&<div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10"><span className="text-white font-medium text-xs bg-black/60 px-3 py-1.5 rounded-full">Нет в наличии</span></div>}</Link><div className="p-3 sm:p-4 flex flex-col flex-1"><Link href={`/shop/${product.slug}`} className="block mb-2"><h3 className="text-xs sm:text-sm font-medium line-clamp-2 leading-snug" style={{color:'var(--foreground)'}}>{product.name}</h3></Link><div className="mt-auto flex items-center justify-between gap-1 pt-2"><div><span className="text-sm sm:text-base font-bold" style={{color:'var(--primary)'}}>{product.price} ₽</span>{!out&&product.stock<=5&&<span className="text-[10px] sm:text-xs text-red-500 ml-1">Ост {product.stock} шт</span>}</div><div className="w-[90px] sm:w-[100px] flex justify-end">{out?<button disabled className="w-full py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium cursor-not-allowed" style={{background:'var(--primary-muted)',color:'var(--foreground-secondary)'}}>Нет</button>:qty===0?<button onClick={e=>{e.preventDefault();updateCart(product,1)}} className="w-full py-1.5 rounded-full text-[10px] sm:text-xs font-medium text-white transition-all active:scale-95" style={{background:'var(--primary)'}}>В корзину</button>:<div className="flex items-center justify-between w-full gap-0.5"><button onClick={e=>{e.preventDefault();updateCart(product,-1)}} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90 flex-shrink-0" style={{background:'var(--primary-muted)',color:'var(--primary)'}}><Minus className="w-3 h-3"/></button><span className="text-xs sm:text-sm font-semibold text-center" style={{color:'var(--foreground)'}}>{qty}</span><button onClick={e=>{e.preventDefault();updateCart(product,1)}} disabled={product.stock>0&&qty>=product.stock} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all active:scale-90 flex-shrink-0 disabled:opacity-50" style={{background:qty>=product.stock?'#777':'var(--primary)'}}><Plus className="w-3 h-3"/></button></div>}</div></div></div></div>)})}</div>)}
            {addedProduct && relatedProducts.length > 0 && (<div className="mt-8 bg-white/80 backdrop-blur rounded-3xl p-5 border border-white/20 shadow-sm"><h3 className="text-sm font-semibold mb-3" style={{color:'var(--foreground)'}}>С этим также берут</h3><div className="grid grid-cols-3 gap-3">{relatedProducts.map(rp => (<Link key={rp.id} href={`/shop/${rp.slug}`} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-colors"><div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">{rp.images?.[0] ? <SiteImage src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50"><Image src="/logo.png" alt="" width={24} height={24} className="opacity-40" unoptimized /></div>}</div><div className="min-w-0"><p className="text-xs font-medium truncate" style={{color:'var(--foreground)'}}>{rp.name}</p><p className="text-xs font-bold mt-0.5" style={{color:'var(--primary)'}}>{rp.price} ₽</p></div></Link>))}</div></div>)}
          </div>
        </div>
      </div>
    </main>
  );
}
