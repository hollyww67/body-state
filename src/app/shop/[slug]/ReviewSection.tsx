"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
import ReviewCard from "@/components/reviews/ReviewCard";
import { ReviewRatingPicker } from "@/components/reviews/ReviewRating";

interface Review {
  id: string;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
}

export default function ReviewSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [publicationConsent, setPublicationConsent] = useState(false);

  const fetchReviews = useCallback(() => {
    setLoading(true);
    fetch(`/api/reviews?product_id=${productId}`)
      .then((r) => r.json())
      .then((data) => { setReviews(data.reviews || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [productId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, author_name: name, rating, text, consent, publication_consent: publicationConsent }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setError(result.error || "Не удалось отправить отзыв");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setName(""); setRating(5); setText("");
    setConsent(false); setPublicationConsent(false);
    fetchReviews();
    setTimeout(() => setDone(false), 3000);
    setSubmitting(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--foreground)' }}>Отзывы</h2>

      {/* Форма */}
      <form onSubmit={submitReview} className="glass-feature rounded-2xl p-5 mb-6 space-y-4">
        <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Оставить отзыв</h3>
        <input required type="text" placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-12 rounded-2xl border px-4 focus:outline-none focus:ring-2" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />

        <div>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>Оценка</label>
          <ReviewRatingPicker value={rating} onChange={setRating} />
        </div>

        <textarea required placeholder="Ваш отзыв" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-2xl border px-4 py-3 focus:outline-none focus:ring-2 resize-none" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }} />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {done && <p className="text-green-600 text-sm">Спасибо! Отзыв отправлен на модерацию.</p>}

        <PersonalDataConsent id={`product-review-consent-${productId}`} checked={consent} onChange={setConsent} />
        <PersonalDataConsent id={`product-review-publication-${productId}`} checked={publicationConsent} onChange={setPublicationConsent} publication />
        <button type="submit" disabled={submitting || !consent || !publicationConsent} className="flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50" style={{ background: 'var(--primary)' }}>
          <Send className="w-4 h-4" /> {submitting ? "Отправляем..." : "Отправить отзыв"}
        </button>
      </form>

      {/* Список отзывов */}
      {loading ? (
        <p style={{ color: 'var(--foreground-secondary)' }}>Загрузка отзывов...</p>
      ) : reviews.length === 0 ? (
        <p style={{ color: 'var(--foreground-secondary)' }}>Отзывов пока нет. Будьте первым!</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      )}
    </div>
  );
}
