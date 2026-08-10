"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Review {
  id: string;
  author_name: string;
  text: string;
  rating: number;
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    fetch("/api/reviews")
      .then(res => res.json())
      .then(data => {
        setReviews(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setCurrent(prev => {
      if (newDirection === 1) {
        return (prev + 1) % reviews.length;
      }
      return (prev - 1 + reviews.length) % reviews.length;
    });
  }, [reviews.length]);

  // Автопрокрутка
  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => paginate(1), 15000);
    return () => clearInterval(timer);
  }, [reviews.length, paginate]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
      rotateY: direction > 0 ? 15 : -15,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
      rotateY: direction < 0 ? 15 : -15,
    }),
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  return (
    <div className="relative max-w-lg mx-auto">
      <Quote className="w-8 h-8 lg:w-10 lg:h-10 mx-auto mb-6 lg:mb-8" style={{ color: 'var(--primary)', opacity: 0.25 }} />

      <div className="relative" style={{ perspective: 1200 }}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
              rotateY: { duration: 0.4 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(_, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            className="glass-feature rounded-3xl p-8 md:p-10 text-center cursor-grab active:cursor-grabbing"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex justify-center gap-0.5 mb-4">
              {[...Array(5)].map((_, j) => (
                <Star
                  key={j}
                  className={`w-5 h-5 ${j < (reviews[current]?.rating || 5) ? "fill-[#E7CFA4] text-[#E7CFA4]" : "text-gray-300"}`}
                />
              ))}
            </div>
            <blockquote className="text-base md:text-lg leading-relaxed mb-6 max-w-md mx-auto" style={{ color: 'var(--foreground)' }}>
              «{reviews[current]?.text}»
            </blockquote>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              {reviews[current]?.author_name}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {reviews.length > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center glass hover:bg-white/80 transition-all z-10"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center glass hover:bg-white/80 transition-all z-10"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex justify-center gap-2 mt-6">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? "w-6" : ""
                }`}
                style={{
                  backgroundColor: i === current ? 'var(--primary)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
