"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Star, MessageSquare, Check } from "lucide-react";

interface Review {
  id: string;
  author_name: string;
  text: string;
  rating: number;
  created_at: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ author_name: "", text: "", rating: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const loadReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data || []);
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
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSubmitted(true);
        setForm({ author_name: "", text: "", rating: 5 });
      } else {
        setError("Что-то пошло не так. Попробуйте позже.");
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
            <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-4" style={{ color: 'var(--foreground)' }}>
              Отзывы
            </h1>
            <p className="text-lg" style={{ color: 'var(--foreground-secondary)' }}>
              Что говорят клиенты о реабилитации
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--foreground-secondary)' }}>Загрузка...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: 'var(--foreground-secondary)' }}>Пока нет отзывов. Будьте первым!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 mb-16">
              {reviews.map((review) => (
                <div key={review.id} className="glass-feature rounded-3xl p-7">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className={`w-4 h-4 ${j < (review.rating || 5) ? "fill-[#E7CFA4] text-[#E7CFA4]" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm lg:text-base leading-relaxed mb-4" style={{ color: 'var(--foreground)' }}>
                    {review.text}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                    {review.author_name}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="glass-feature rounded-3xl p-7 lg:p-10">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--primary-muted)' }}>
                  <Check className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Спасибо за отзыв!
                </h2>
                <p style={{ color: 'var(--foreground-secondary)' }}>
                  Ваш отзыв опубликован.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                    Оставить отзыв
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
                      value={form.author_name}
                      onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                      placeholder="Как вас зовут?"
                      className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Оценка</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setForm({ ...form, rating: star })} className="p-1">
                          <Star className={`w-6 h-6 ${star <= form.rating ? "fill-[#E7CFA4] text-[#E7CFA4]" : "text-gray-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Ваш отзыв</label>
                    <textarea
                      rows={4}
                      value={form.text}
                      onChange={(e) => setForm({ ...form, text: e.target.value })}
                      placeholder="Поделитесь впечатлениями о реабилитации..."
                      className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all resize-none"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                  <button type="submit" className="liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-8 py-3.5 text-sm font-medium">
                    <span className="relative z-10">Отправить отзыв</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
