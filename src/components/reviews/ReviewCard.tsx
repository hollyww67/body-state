"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Flag, Quote } from "lucide-react";
import ReviewReportDialog from "./ReviewReportDialog";
import { ReviewRating } from "./ReviewRating";

type Review = {
  id: string;
  author_name: string;
  text: string;
  rating: number;
};

function removeAccidentalRepeat(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  for (let split = Math.floor(text.length * 0.45); split <= Math.ceil(text.length * 0.55); split += 1) {
    if (text.slice(0, split).trim() === text.slice(split).trim()) return text.slice(0, split).trim();
  }
  return text;
}

export default function ReviewCard({ review }: { review: Review }) {
  const text = useMemo(() => removeAccidentalRepeat(review.text), [review.text]);
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const isLong = text.length > 380;

  return (
    <article className="glass-feature relative flex h-fit flex-col overflow-hidden rounded-3xl p-6 md:p-7">
      <Quote aria-hidden="true" className="pointer-events-none absolute -right-2 -top-3 h-20 w-20 rotate-12 opacity-[.055]" style={{ color: "var(--primary)" }} />
      <ReviewRating rating={review.rating || 5} />
      <p className="review-copy mt-5 whitespace-pre-line" style={{ color: "var(--foreground)" }}>
        {isLong && !expanded ? `${text.slice(0, 360).trim()}…` : text}
      </p>
      {isLong && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-semibold" style={{ color: "var(--primary)" }} aria-expanded={expanded}>
          {expanded ? "Свернуть" : "Читать полностью"}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
      <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="review-author text-sm font-semibold" style={{ color: "var(--primary)" }}>{review.author_name}</p>
        <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--primary-muted)]" style={{ color: "var(--foreground-secondary)" }} aria-label={`Пожаловаться на отзыв автора ${review.author_name}`}>
          <Flag className="h-3.5 w-3.5" />Пожаловаться
        </button>
      </div>
      {reporting && <ReviewReportDialog reviewId={review.id} reviewAuthor={review.author_name} onClose={() => setReporting(false)} />}
    </article>
  );
}
