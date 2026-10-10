"use client";

import { Star } from "lucide-react";

const moods = [
  { emoji: "😔", label: "Не понравилось", tone: "rose" },
  { emoji: "😕", label: "Скорее нет", tone: "orange" },
  { emoji: "🙂", label: "Нормально", tone: "amber" },
  { emoji: "😊", label: "Понравилось", tone: "teal" },
  { emoji: "🥰", label: "Великолепно", tone: "violet" },
] as const;

function safeRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value || 5)));
}

export function ReviewRating({ rating, compact = false }: { rating: number; compact?: boolean }) {
  const value = safeRating(rating);
  const mood = moods[value - 1];
  return <div className={`review-rating ${compact ? "review-rating--compact" : ""}`} aria-label={`Оценка ${value} из 5 — ${mood.label}`}>
    <span className={`review-mood review-mood--${mood.tone}`} aria-hidden="true">{mood.emoji}</span>
    <span className="review-stars" aria-hidden="true">{moods.map((_, index) => <Star key={index} className={index < value ? "is-active" : ""} />)}</span>
    {!compact && <span className="review-rating-label">{mood.label}</span>}
  </div>;
}

export function ReviewRatingPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return <div className="review-rating-picker" role="radiogroup" aria-label="Оценка отзыва">
    {moods.map((mood, index) => {
      const rating = index + 1;
      const selected = safeRating(value) === rating;
      return <button key={mood.label} type="button" role="radio" aria-checked={selected} aria-label={`${rating} из 5 — ${mood.label}`} onClick={() => onChange(rating)} className={`review-rating-option review-mood--${mood.tone} ${selected ? "is-selected" : ""}`}>
        <span className="review-rating-emoji" aria-hidden="true">{mood.emoji}</span>
        <span className="review-rating-number">{rating}</span>
        <span className="review-rating-option-label">{mood.label}</span>
      </button>;
    })}
  </div>;
}

