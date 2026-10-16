"use client";
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import { AdminPageHeader, AdminLoadingState, AdminBadge, AdminFeedback, AdminButton, AdminCard, AdminInput, AdminTextarea } from '@/components/admin/ui';

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
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
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

  return <div className="admin-reviews-page bs-page">
      {deleteTarget && <AdminConfirmDialog title="Удалить отзыв?" onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteReview(deleteTarget.id)}><p>{deleteTarget.author_name}</p><p>Удалить отзыв и связанные жалобы без возможности восстановления?</p></AdminConfirmDialog>}
    <AdminPageHeader title="Отзывы и жалобы" description={`${reviews.length} отзывов · ${openReports.length} жалоб требуют решения`}><AdminButton variant="primary" onClick={() => setShowAddForm(true)} className="gap-2"><Plus className="h-4 w-4" />Добавить с подтверждением</AdminButton></AdminPageHeader>
    {error && <AdminFeedback tone="destructive">{error}</AdminFeedback>}

    {openReports.length > 0 && <AdminCard className="md:p-6">
      <div className="mb-4 flex items-center gap-3"><Flag className="h-5 w-5 text-[var(--bs-warning)]" /><h2 className="bs-section-heading">Новые жалобы</h2></div>
      <div className="space-y-3">{openReports.map((report) => <AdminCard key={report.id}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><AdminBadge tone="warning">{reasonLabels[report.reason] || report.reason}</AdminBadge><span className="text-xs text-[var(--bs-muted)]">Отзыв #{report.review_id} · {report.review_author}</span></div>
          {report.details && <p className="mt-3 text-sm text-[var(--bs-foreground)]">{report.details}</p>}<p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--bs-muted)]">{report.review_text}</p>{report.reporter_email && <p className="mt-2 text-xs text-[var(--bs-muted)]">Для ответа: {report.reporter_email}</p>}
        </div><div className="bs-toolbar"><AdminButton variant="destructive" onClick={() => hideFromReport(report)} className="gap-1.5"><EyeOff className="h-3.5 w-3.5" />Скрыть отзыв</AdminButton><AdminButton variant="secondary" onClick={() => updateReport(report.id, "resolved", "Нарушение не подтверждено, публикация сохранена")} className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Оставить</AdminButton></div></div>
      </AdminCard>)}</div>
    </AdminCard>}

    {showAddForm && <AdminCard>
      <div className="mb-5 flex items-center justify-between"><div><h2 className="bs-section-heading">Добавить отзыв</h2><p className="mt-1 text-xs text-[var(--bs-muted)]">Публикуйте только при наличии сохранённого согласия автора.</p></div><AdminButton variant="ghost" size="icon" aria-label="Закрыть форму добавления отзыва" onClick={() => setShowAddForm(false)}><X className="h-5 w-5" /></AdminButton></div>
      <div className="grid gap-4"><AdminInput aria-label="Имя или псевдоним автора" value={newForm.author_name} onChange={(event) => setNewForm({ ...newForm, author_name: event.target.value })} maxLength={80} placeholder="Имя или псевдоним автора" />
        <div className="flex gap-1">{[1,2,3,4,5].map((rating) => <AdminButton variant="ghost" size="icon" key={rating} aria-label={`Оценка: ${rating} из 5`} aria-pressed={rating === newForm.rating} type="button" onClick={() => setNewForm({ ...newForm, rating })}><Star className={`h-6 w-6 ${rating <= newForm.rating ? "fill-[var(--bs-warning)] text-[var(--bs-warning)]" : "text-[var(--bs-border-strong)]"}`} /></AdminButton>)}</div>
        <AdminTextarea aria-label="Текст отзыва" value={newForm.text} onChange={(event) => setNewForm({ ...newForm, text: event.target.value })} maxLength={3000} rows={4} placeholder="Текст отзыва" className="resize-none" />
        <AdminInput aria-label="Подтверждение согласия автора" value={newForm.publication_consent_evidence} onChange={(event) => setNewForm({ ...newForm, publication_consent_evidence: event.target.value })} maxLength={300} placeholder="Где хранится согласие: договор/сообщение и дата" />
        <div className="flex gap-3"><AdminButton variant="primary" onClick={addReview}>Добавить и опубликовать</AdminButton><AdminButton variant="outline" onClick={() => setShowAddForm(false)}>Отмена</AdminButton></div>
      </div>
    </AdminCard>}

    <section><div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bs-muted)]" /><AdminInput aria-label="Поиск по отзывам" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по отзывам" className="w-full pl-10" /></div>
      {loading ? <AdminLoadingState /> : <div className="space-y-3">{filteredReviews.map((review) => <AdminCard key={review.id}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-[var(--bs-foreground)]">{review.author_name}</span><AdminBadge tone={review.is_published ? "success" : "neutral"}>{review.is_published ? "Опубликован" : "На модерации"}</AdminBadge>{review.open_reports > 0 && <AdminBadge tone="destructive"><AlertTriangle className="h-3 w-3" />Жалоб: {review.open_reports}</AdminBadge>}</div>
          <div className="mt-2 flex gap-0.5">{[...Array(5)].map((_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < review.rating ? "fill-[var(--bs-warning)] text-[var(--bs-warning)]" : "text-[var(--bs-border-strong)]"}`} />)}</div><p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--bs-muted)]">{review.text}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--bs-muted)]"><span>{new Date(review.created_at).toLocaleDateString("ru-RU")}</span><span>Источник: {review.source}</span><span>{review.publication_consent_at || review.publication_consent_evidence ? "Согласие зафиксировано" : "Нет цифрового подтверждения согласия"}</span></div>
          {!review.publication_consent_at && !review.publication_consent_evidence && <div className="mt-4 flex max-w-2xl flex-col gap-2 rounded-[var(--bs-radius-control)] border border-[var(--bs-border)] bg-[var(--bs-warning-bg)] p-3 sm:flex-row"><AdminInput aria-label="Подтверждение согласия автора" value={evidenceDrafts[review.id] || ""} onChange={(event) => setEvidenceDrafts({ ...evidenceDrafts, [review.id]: event.target.value })} maxLength={300} placeholder="Где хранится согласие автора и дата" className="min-w-0 flex-1" /><AdminButton variant="primary" onClick={() => updateReview(review.id, { publication_consent_evidence: evidenceDrafts[review.id] })} disabled={!evidenceDrafts[review.id]?.trim()}>Зафиксировать</AdminButton></div>}
          </div>
          <div className="bs-toolbar">{review.is_published ? <AdminButton variant="ghost" onClick={() => updateReview(review.id, { is_published: false, moderation_status: "pending" })} className="gap-1.5"><EyeOff className="h-4 w-4" />Скрыть</AdminButton> : <AdminButton variant="secondary" onClick={() => updateReview(review.id, { is_published: true, moderation_status: "published" })} className="gap-1.5"><Eye className="h-4 w-4" />Опубликовать</AdminButton>}<AdminButton variant="destructive" size="icon" onClick={() => setDeleteTarget(review)}  aria-label={`Удалить отзыв ${review.author_name}`}><Trash2 className="h-4 w-4" /></AdminButton></div></div>
      </AdminCard>)}</div>}
    </section>
  </div>;
}
