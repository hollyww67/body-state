"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

type PublicReview = { id: string | number; author_name: string; text: string; rating?: number; product_id?: string | null };

export default function EditorialReviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews")
      .then(async (response) => {
        if (!response.ok) throw new Error("Reviews unavailable");
        return response.json();
      })
      .then((data) => { if (active && Array.isArray(data)) setReviews(data.filter((item: PublicReview) => !item.product_id)); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="bs-e-review-placeholder" role="status">Загружаем отзывы…</p>;
  if (!reviews.length) return <p className="bs-e-review-placeholder">Отзывы скоро появятся здесь.</p>;

  const review = reviews[current];
  return (
    <div className="bs-e-review">
      <div className="bs-e-review-body" aria-live="polite" aria-atomic="true">
        <blockquote>«{review.text}»</blockquote>
        <p className="bs-e-review-author">{review.author_name}</p>
      </div>
      {reviews.length > 1 && (
        <div className="bs-e-review-controls">
          <span aria-hidden="true">{String(current + 1).padStart(2, "0")} / {String(reviews.length).padStart(2, "0")}</span>
          <div>
            <button type="button" aria-label="Предыдущий отзыв" onClick={() => setCurrent((value) => (value - 1 + reviews.length) % reviews.length)}>
              <ArrowLeft aria-hidden="true" size={19} strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Следующий отзыв" onClick={() => setCurrent((value) => (value + 1) % reviews.length)}>
              <ArrowRight aria-hidden="true" size={19} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
