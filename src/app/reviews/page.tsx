"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { MessageSquare, Check, Sparkles } from "lucide-react";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
import ReviewCard from "@/components/reviews/ReviewCard";
import { ReviewRatingPicker } from "@/components/reviews/ReviewRating";
import { usePageCopy } from "@/lib/hooks/use-page-copy";

interface Review {
  id: string;
  author_name: string;
  text: string;
  rating: number;
  created_at: string;
}

export default function ReviewsPage() {
  const copy = usePageCopy("reviews");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ author_name: "", text: "", rating: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [publicationConsent, setPublicationConsent] = useState(false);

  const loadReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data || []);
      } else {
        setError("Не удалось загрузить отзывы. Попробуйте обновить страницу.");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.author_name.trim() || !form.text.trim()) {
      setError("Пожалуйста, заполните имя и текст отзыва");
      return;
    }

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent, publication_consent: publicationConsent }),
      });

      if (res.ok) {
        setSubmitted(true);
        setForm({ author_name: "", text: "", rating: 5 });
        setConsent(false);
        setPublicationConsent(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Что-то пошло не так. Попробуйте позже.");
      }
    } catch {
      setError("Что-то пошло не так. Попробуйте позже.");
    }
  };

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[.14em]" style={{ color: "var(--primary)", borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}><Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}</div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-4" style={{ color: 'var(--foreground)' }}>
              {copy.title}
            </h1>
            <p className="text-lg" style={{ color: 'var(--foreground-secondary)' }}>
              {copy.lead}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--foreground-secondary)' }}>Загрузка...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--foreground-secondary)' }}>{copy.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:gap-6 mb-16">
              {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
          )}

          <div className="glass-feature rounded-3xl p-7 lg:p-10">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--primary-muted)' }}>
                  <Check className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  {copy.successTitle}
                </h2>
                <p style={{ color: 'var(--foreground-secondary)' }}>
                  {copy.successText}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                    {copy.formTitle}
                  </h2>
                </div>
                {error && (
                  <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                    {error}
                  </div>
                )}
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Ваше имя</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={form.author_name}
                      onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                      placeholder="Как вас зовут?"
                      className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Оценка</label>
                    <ReviewRatingPicker value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Ваш отзыв</label>
                    <textarea
                      rows={4}
                      maxLength={3000}
                      value={form.text}
                      onChange={(e) => setForm({ ...form, text: e.target.value })}
                      placeholder="Поделитесь впечатлениями о реабилитации..."
                      className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all resize-none"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--foreground-secondary)" }}>Не указывайте диагнозы, контакты и сведения о здоровье — свои или третьих лиц. Перед отправкой ознакомьтесь с <Link href="/review-rules" target="_blank" className="underline underline-offset-2">правилами публикации отзывов</Link>.</p>
                  </div>
                  <PersonalDataConsent id="review-consent" checked={consent} onChange={setConsent} />
                  <PersonalDataConsent id="review-publication-consent" checked={publicationConsent} onChange={setPublicationConsent} publication />
                  <button type="submit" disabled={!consent || !publicationConsent} className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-8 py-3.5 text-sm font-medium disabled:opacity-50">
                    <span className="relative z-10">{copy.submitButton}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
