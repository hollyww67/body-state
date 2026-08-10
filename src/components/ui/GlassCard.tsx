"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";

export default function GlassCard({
  children,
  href,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };

    card.addEventListener("mousemove", handleMouseMove);
    return () => card.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const content = (
    <div
      ref={cardRef}
    className={`liquid-card h-full relative overflow-hidden rounded-[28px] p-7 ${className}`}
      style={{ "--mouse-x": `${mousePos.x}%`, "--mouse-y": `${mousePos.y}%` } as React.CSSProperties}
    >
      <div className="liquid-glow" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  if (href) {
    return <Link href={href} className="group block h-full">{content}</Link>;
  }
  return content;
}
