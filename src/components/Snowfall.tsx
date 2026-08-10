"use client";

import { useEffect, useRef, useState } from "react";

interface Snowflake { x: number; y: number; r: number; speed: number; opacity: number; wobble: number; wobbleSpeed: number; windDrift: number; }

export default function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Только десктоп + новогодняя тема
    const check = () => {
      const isNewYear = document.documentElement.getAttribute("data-theme") === "newyear";
      const isDesktop = window.innerWidth >= 768;
      setEnabled(isNewYear && isDesktop);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", check);
    return () => { obs.disconnect(); window.removeEventListener("resize", check); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let flakes: Snowflake[] = [];
    let time = 0;
    let visible = true;

    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      flakes = [];
      for (let i = 0; i < 40; i++) {
        flakes.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          r: Math.random() * 2 + 0.5, speed: Math.random() * 0.4 + 0.15,
          opacity: Math.random() * 0.35 + 0.2, wobble: Math.random() * 100,
          wobbleSpeed: Math.random() * 0.01 + 0.003, windDrift: Math.random() * 0.3,
        });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      if (!visible || frameCount % 3 !== 0) { animationId = requestAnimationFrame(animate); return; }
      time += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const wind = Math.sin(time) * 0.2;
      ctx.filter = "blur(0.5px)";
      flakes.forEach((f) => {
        f.y += f.speed; f.wobble += f.wobbleSpeed;
        const x = f.x + Math.sin(f.wobble) * 1.2 + wind * f.windDrift * f.y * 0.01;
        if (f.y > canvas.height + 10) { f.y = -10; f.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,240,${f.opacity})`; ctx.fill();
      });
      ctx.filter = "none";
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }} />;
}
