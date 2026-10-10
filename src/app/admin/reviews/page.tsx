"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Flag, Plus, Search, Star, Trash2, X } from "lucide-react";

type Review = {
  id: number; author_name: string; text: string; rating: number; created_at: string;
  is_published: boolean; moderation_status: "pending" | "published" | "rejected"; source: string;
  publication_consent_at: string | null; publication_consent_evidence: string | null; open_reports: number;
};
type Report = {
  id: string; review_id: number; reason: string; details: string | null; reporter_email: string | null;
  status: "new" | "reviewing" | "resolved" | "rejected"; created_at: string; review_author: string; review_text: string;
};

const reasonLabels: Record<string, string> = {
  personal_data: "Персональные данные", false_information: "Недостоверная информация",
  offensive: "Оскорбления или травля", prohibited_content: "Запрещённый контент",
  rights_violation: "Нарушение прав", other: "Другая причина",
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<number, string>>({});
  const [newForm, setNewForm] = useState({ author_name: "", text: "", rating: 5, publication_consent_evidence: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/reviews", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка загрузки");
      setReviews(data.reviews || []); setReports(data.reports || []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? reviews.filter((review) => `${review.author_name} ${review.text}`.toLowerCase().includes(query)) : reviews;
  }, [reviews, search]);
  const openReports = reports.filter((report) => report.status === "new" || report.status === "reviewing");

  const updateReview = async (id: number, body: Record<string, unknown>) => {
    setError("");
    const response = await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Не удалось обновить отзыв"); return false; }
    await loadData(); return true;
  };
  const deleteReview = async (id: number) => {
    if (!confirm("Удалить отзыв и связанные жалобы без возможности восстановления?")) return;
    const response = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (!response.ok) return setError("Не удалось удалить отзыв"); await loadData();
  };
  const addReview = async () => {
    setError("");
    const response = await fetch("/api/admin/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newForm) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error || "Не удалось добавить отзыв");
    setShowAddForm(false); setNewForm({ author_name: "", text: "", rating: 5, publication_consent_evidence: "" }); await loadData();
  };
  const updateReport = async (id: string, status: Report["status"], resolution_note: string) => {
    const response = await fetch(`/api/admin/review-reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, resolution_note }) });
    if (!response.ok) return setError("Не удалось обновить жалобу"); await loadData();
  };
  const hideFromReport = async (report: Report) => {
    const hidden = await updateReview(report.review_id, { is_published: false, moderation_status: "pending", moderation_note: `Скрыт по жалобе ${report.id}` });
    if (hidden) await updateReport(report.id, "resolved", "Отзыв скрыт до завершения проверки");
  };

  return <div className="admin-reviews-page space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-semibold text-slate-900">Отзывы и жалобы</h1><p className="mt-1 text-sm text-slate-500">{reviews.length} отзывов · {openReports.length} жалоб требуют решения</p></div>
      <button onClick={() => setShowAddForm(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20"><Plus className="h-4 w-4" />Добавить с подтверждением</button>
    </div>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    {openReports.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3"><Flag className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-semibold text-slate-900">Новые жалобы</h2></div>
      <div className="space-y-3">{openReports.map((report) => <article key={report.id} className="rounded-2xl border border-amber-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{reasonLabels[report.reason] || report.reason}</span><span className="text-xs text-slate-400">Отзыв #{report.review_id} · {report.review_author}</span></div>
          {report.details && <p className="mt-3 text-sm text-slate-700">{report.details}</p>}<p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{report.review_text}</p>{report.reporter_email && <p className="mt-2 text-xs text-slate-500">Для ответа: {report.reporter_email}</p>}
        </div><div className="flex flex-wrap gap-2"><button onClick={() => hideFromReport(report)} className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"><EyeOff className="h-3.5 w-3.5" />Скрыть отзыв</button><button onClick={() => updateReport(report.id, "resolved", "Нарушение не подтверждено, публикация сохранена")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Оставить</button></div></div>
      </article>)}</div>
    </section>}

    {showAddForm && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Добавить отзыв</h2><p className="mt-1 text-xs text-slate-500">Публикуйте только при наличии сохранённого согласия автора.</p></div><button onClick={() => setShowAddForm(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4"><input value={newForm.author_name} onChange={(event) => setNewForm({ ...newForm, author_name: event.target.value })} maxLength={80} placeholder="Имя или псевдоним автора" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
        <div className="flex gap-1">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" onClick={() => setNewForm({ ...newForm, rating })} className="p-1"><Star className={`h-6 w-6 ${rating <= newForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div>
        <textarea value={newForm.text} onChange={(event) => setNewForm({ ...newForm, text: event.target.value })} maxLength={3000} rows={4} placeholder="Текст отзыва" className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
        <input value={newForm.publication_consent_evidence} onChange={(event) => setNewForm({ ...newForm, publication_consent_evidence: event.target.value })} maxLength={300} placeholder="Где хранится согласие: договор/сообщение и дата" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
        <div className="flex gap-3"><button onClick={addReview} className="rounded-2xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white">Добавить и опубликовать</button><button onClick={() => setShowAddForm(false)} className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-600">Отмена</button></div>
      </div>
    </section>}

    <section><div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по отзывам" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm" /></div>
      {loading ? <div className="py-14 text-center text-sm text-slate-500">Загрузка…</div> : <div className="space-y-3">{filteredReviews.map((review) => <article key={review.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{review.author_name}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${review.is_published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{review.is_published ? "Опубликован" : "На модерации"}</span>{review.open_reports > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" />Жалоб: {review.open_reports}</span>}</div>
          <div className="mt-2 flex gap-0.5">{[...Array(5)].map((_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div><p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{review.text}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>{new Date(review.created_at).toLocaleDateString("ru-RU")}</span><span>Источник: {review.source}</span><span>{review.publication_consent_at || review.publication_consent_evidence ? "Согласие зафиксировано" : "Нет цифрового подтверждения согласия"}</span></div>
          {!review.publication_consent_at && !review.publication_consent_evidence && <div className="mt-4 flex max-w-2xl flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row"><input value={evidenceDrafts[review.id] || ""} onChange={(event) => setEvidenceDrafts({ ...evidenceDrafts, [review.id]: event.target.value })} maxLength={300} placeholder="Где хранится согласие автора и дата" className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs" /><button onClick={() => updateReview(review.id, { publication_consent_evidence: evidenceDrafts[review.id] })} disabled={!evidenceDrafts[review.id]?.trim()} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Зафиксировать</button></div>}
          </div>
          <div className="flex flex-wrap gap-2">{review.is_published ? <button onClick={() => updateReview(review.id, { is_published: false, moderation_status: "pending" })} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"><EyeOff className="h-4 w-4" />Скрыть</button> : <button onClick={() => updateReview(review.id, { is_published: true, moderation_status: "published" })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Eye className="h-4 w-4" />Опубликовать</button>}<button onClick={() => deleteReview(review.id)} className="rounded-xl bg-red-50 p-2 text-red-600" aria-label={`Удалить отзыв ${review.author_name}`}><Trash2 className="h-4 w-4" /></button></div></div>
      </article>)}</div>}
    </section>
  </div>;
}
