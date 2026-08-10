"use client";

import { useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let visible = true;
    const isMobile = window.innerWidth < 768;

    // На мобильных — статичный фон без анимации
    if (isMobile) {
      const theme = document.documentElement.getAttribute("data-theme") || "teal";
      const color = theme === "violet" ? "167,139,250" : theme === "ironman" ? "193,18,47" : theme === "newyear" ? "59,130,246" : "20,184,166";
      const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
      gradient.addColorStop(0, `rgba(${color}, 0.03)`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    const getTheme = () => document.documentElement.getAttribute("data-theme") || "teal";
    let particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 5; i++) {
        particles.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08,
          size: Math.random() * 300 + 150,
          opacity: Math.random() * 0.025 + 0.01,
        });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      if (!visible || frameCount % 5 !== 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      const theme = getTheme();
      const color = theme === "violet" ? "167,139,250" : theme === "ironman" ? "193,18,47" : theme === "newyear" ? "59,130,246" : "20,184,166";

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(${color}, ${p.opacity * 2})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient; ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}
