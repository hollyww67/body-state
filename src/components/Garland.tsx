"use client";

import { useEffect, useState, useRef } from "react";

interface Bulb {
  x: number;
  y: number;
  r: number;
  color: string;
  baseOpacity: number;
  phase: number;
}

const COLORS = ["#FF4444", "#FFD700", "#4488FF", "#44FF44", "#FF44FF", "#FF8844", "#44FFFF"];

export default function Garland() {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const check = () => setVisible(document.documentElement.getAttribute("data-theme") === "newyear");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    let frameCount = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = 100;
    };

    const createBulbs = (): Bulb[] => {
      const bulbs: Bulb[] = [];
      const navWidth = Math.min(window.innerWidth - 32, 1280);
      const startX = (window.innerWidth - navWidth) / 2;
      const count = 10;

      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = startX + t * navWidth;
        const sagY = 50 + Math.sin(t * Math.PI) * 20;
        bulbs.push({
          x,
          y: sagY,
          r: 2.5 + (i % 2) * 0.8,
          color: COLORS[i % COLORS.length],
          baseOpacity: 0.6 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
        });
      }
      return bulbs;
    };

    let bulbs = createBulbs();

    resize();
    window.addEventListener("resize", () => { resize(); bulbs = createBulbs(); });

    const animate = () => {
      frameCount++;
      // 20 FPS
      if (frameCount % 3 !== 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      time += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bulbs.length > 0) {
        const firstX = bulbs[0].x;
        const lastX = bulbs[bulbs.length - 1].x;

        ctx.beginPath();
        ctx.moveTo(firstX, 12);
        ctx.quadraticCurveTo((firstX + lastX) / 2, 55, lastX, 12);
        ctx.strokeStyle = "rgba(50,60,70,0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        bulbs.forEach((b) => {
          const t = (b.x - firstX) / (lastX - firstX);
          const wireY = 12 + (1 - 4 * (t - 0.5) * (t - 0.5)) * 43;

          ctx.beginPath();
          ctx.moveTo(b.x, wireY);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = "rgba(50,60,70,0.3)";
          ctx.lineWidth = 0.7;
          ctx.stroke();
        });
      }

      bulbs.forEach((b) => {
        const flicker = 0.7 + 0.2 * Math.sin(time * 2 + b.phase) + 0.08 * Math.sin(time * 7 + b.phase * 2);
        const opacity = b.baseOpacity * flicker;

        // Упрощённое свечение
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = b.color + Math.round(opacity * 60).toString(16).padStart(2, "0");
        ctx.fill();

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color + Math.round(opacity * 230).toString(16).padStart(2, "0");
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full pointer-events-none"
      style={{ zIndex: 51 }}
    />
  );
}
