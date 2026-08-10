"use client";

import { useEffect, useRef } from "react";

export default function AnimatedLogo({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animation: any = null;

    const loadLottie = async () => {
      try {
        const res = await fetch("/animations/logo-animation.json");
        const data = await res.json();

        // Используем Web Animations API как fallback
        if (containerRef.current) {
          const el = containerRef.current;

          // Дыхание — scale
          el.animate(
            [
              { transform: "scale(0.95)", opacity: 0 },
              { transform: "scale(1)", opacity: 1, offset: 0.25 },
              { transform: "scale(1.05)", opacity: 1, offset: 0.5 },
              { transform: "scale(1)", opacity: 1, offset: 0.75 },
              { transform: "scale(0.95)", opacity: 0 },
            ],
            {
              duration: 4000,
              iterations: Infinity,
              easing: "ease-in-out",
            }
          );
        }
      } catch {
        // fallback — просто показываем круг
      }
    };

    loadLottie();

    return () => {
      if (animation) animation.destroy();
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ width: 40, height: 40 }}>
      <svg viewBox="0 0 512 512" className="w-full h-full">
        {/* Внешнее кольцо */}
        <circle
          cx="256"
          cy="256"
          r="100"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-teal-600"
        >
          <animate
            attributeName="r"
            values="95;105;95"
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Внутренние частицы */}
        <circle cx="256" cy="180" r="3" fill="#d4f1f0" opacity="0">
          <animate
            attributeName="cy"
            values="400;100"
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="220" cy="200" r="2" fill="#d4f1f0" opacity="0">
          <animate
            attributeName="cy"
            values="380;120"
            dur="3.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="3.5s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="290" cy="190" r="2.5" fill="#d4f1f0" opacity="0">
          <animate
            attributeName="cy"
            values="420;90"
            dur="3.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="3.8s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Блик */}
        <rect x="0" y="200" width="120" height="512" fill="white" opacity="0">
          <animate
            attributeName="x"
            values="0;512"
            dur="3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.15;0"
            dur="3s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Центральная точка */}
        <circle cx="256" cy="256" r="8" fill="currentColor" className="text-teal-500">
          <animate
            attributeName="r"
            values="6;10;6"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}
