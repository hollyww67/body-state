"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";

export default function ProductGallery({ images, productName }: { images: string[]; productName: string }) {
  const [active, setActive] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square rounded-3xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <ShoppingBag className="w-16 h-16" style={{ color: 'var(--foreground-secondary)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Главное изображение */}
      <div className="relative aspect-square rounded-3xl overflow-hidden mb-4" style={{ background: 'var(--bg-secondary)' }}>
        <img
          src={images[active]}
          alt={productName}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center hover:bg-white transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5 text-[#111827]" />
            </button>
            <button
              onClick={() => setActive((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center hover:bg-white transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5 text-[#111827]" />
            </button>
          </>
        )}
      </div>

      {/* Миниатюры */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                i === active ? "border-[var(--primary)] opacity-100" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{ borderColor: i === active ? 'var(--primary)' : 'transparent' }}
            >
              <img src={img} alt={`${productName} ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
