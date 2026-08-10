"use client";

import { useState, useEffect } from "react";
import { Star, Trash2, Plus, X, Edit3, Search } from "lucide-react";

interface Review {
  id: number;
  author_name: string;
  text: string;
  rating: number;
  created_at: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ author_name: "", text: "", rating: 5 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState({ author_name: "", text: "", rating: 5 });
  const [search, setSearch] = useState("");

  const loadReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReviews(); }, []);

  useEffect(() => {
    let result = reviews;
    if (search) {
      result = result.filter(r =>
        r.author_name.toLowerCase().includes(search.toLowerCase()) ||
        r.text.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFilteredReviews(result);
  }, [search, reviews]);

  const deleteReview = async (id: number) => {
    if (!confirm("Удалить отзыв?")) return;
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    loadReviews();
  };

  const startEdit = (review: Review) => {
    setEditingId(review.id);
    setEditForm({ author_name: review.author_name, text: review.text, rating: review.rating });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch(`/api/reviews/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    loadReviews();
  };

  const addReview = async () => {
    if (!newForm.author_name.trim() || !newForm.text.trim()) return;
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    setShowAddForm(false);
    setNewForm({ author_name: "", text: "", rating: 5 });
    loadReviews();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Отзывы</h1>
          <p className="text-sm text-slate-500 mt-1">Управление отзывами — {reviews.length} всего</p>
        </div>
        <button onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-5 py-2.5 text-sm font-semibold shadow-lg shadow-teal-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
          className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
      </div>

      {showAddForm && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Новый отзыв</h2>
            <button onClick={() => setShowAddForm(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="Имя автора" value={newForm.author_name} onChange={e => setNewForm({ ...newForm, author_name: e.target.value })}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm" />
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setNewForm({ ...newForm, rating: s })} className="p-1">
                  <Star className={`w-6 h-6 ${s <= newForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              ))}
            </div>
            <textarea rows={3} placeholder="Текст отзыва" value={newForm.text} onChange={e => setNewForm({ ...newForm, text: e.target.value })}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm resize-none" />
            <div className="flex gap-3">
              <button onClick={addReview} className="rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-6 py-2.5 text-sm font-semibold">Добавить</button>
              <button onClick={() => setShowAddForm(false)} className="rounded-2xl bg-slate-100 text-slate-600 px-6 py-2.5 text-sm font-semibold border border-slate-200">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-slate-500">Загрузка...</p></div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/60">
          <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-900">Нет отзывов</p>
          <p className="text-sm text-slate-500 mt-1">Добавьте первый отзыв</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map(review => (
            <div key={review.id} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
              {editingId === review.id ? (
                <div className="space-y-3">
                  <input type="text" value={editForm.author_name} onChange={e => setEditForm({ ...editForm, author_name: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm" />
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => setEditForm({ ...editForm, rating: s })} className="p-1">
                        <Star className={`w-5 h-5 ${s <= editForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                      </button>
                    ))}
                  </div>
                  <textarea rows={3} value={editForm.text} onChange={e => setEditForm({ ...editForm, text: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm resize-none" />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="rounded-xl bg-teal-500 text-white px-4 py-1.5 text-xs font-semibold">Сохранить</button>
                    <button onClick={() => setEditingId(null)} className="rounded-xl bg-slate-100 text-slate-600 px-4 py-1.5 text-xs font-semibold border border-slate-200">Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900 truncate">{review.author_name}</span>
                      <div className="flex gap-0.5 flex-shrink-0">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className={`w-3 h-3 ${j < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{review.text}</p>
                    <p className="text-xs text-slate-400 mt-2">{new Date(review.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(review)} className="p-2 rounded-lg hover:bg-slate-100" title="Редактировать"><Edit3 className="w-4 h-4 text-slate-400" /></button>
                    <button onClick={() => deleteReview(review.id)} className="p-2 rounded-lg hover:bg-slate-100" title="Удалить"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
