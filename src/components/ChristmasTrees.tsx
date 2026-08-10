"use client";

import { useEffect, useState } from "react";

export default function ChristmasTrees() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(document.documentElement.getAttribute("data-theme") === "newyear");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 3, opacity: 0.65 }}>
      {/* Левая ёлка */}
      <div className="absolute bottom-0 left-8 w-24 h-72">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-t from-green-900/30 to-green-700/15 blur-xl opacity-60" />
        <svg viewBox="0 0 100 300" className="w-full h-full">
          <polygon points="50,40 10,160 90,160" fill="rgba(34,139,34,0.5)" />
          <polygon points="50,80 15,180 85,180" fill="rgba(34,139,34,0.55)" />
          <polygon points="50,120 20,200 80,200" fill="rgba(34,139,34,0.5)" />
          <polygon points="50,150 10,260 90,260" fill="rgba(34,139,34,0.45)" />
          <rect x="42" y="260" width="16" height="30" fill="rgba(139,90,43,0.55)" rx="3" />
          <circle cx="50" cy="70" r="5" fill="#FFD700" style={{ animation: "twinkle 3s ease-in-out infinite alternate" }} />
          <circle cx="35" cy="150" r="4" fill="#FF4444" style={{ animation: "twinkle 2.5s ease-in-out 0.5s infinite alternate" }} />
          <circle cx="65" cy="180" r="3.5" fill="#FFD700" style={{ animation: "twinkle 4s ease-in-out 1s infinite alternate" }} />
          <circle cx="45" cy="220" r="4" fill="#4488FF" style={{ animation: "twinkle 3.5s ease-in-out 0.3s infinite alternate" }} />
          <circle cx="55" cy="110" r="3" fill="#FFD700" style={{ animation: "twinkle 2.8s ease-in-out 0.8s infinite alternate" }} />
        </svg>
      </div>

      {/* Правая ёлка */}
      <div className="absolute bottom-0 right-8 w-24 h-72">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-t from-green-900/30 to-green-700/15 blur-xl opacity-60" />
        <svg viewBox="0 0 100 300" className="w-full h-full">
          <polygon points="50,40 10,160 90,160" fill="rgba(34,139,34,0.5)" />
          <polygon points="50,80 15,180 85,180" fill="rgba(34,139,34,0.55)" />
          <polygon points="50,120 20,200 80,200" fill="rgba(34,139,34,0.5)" />
          <polygon points="50,150 10,260 90,260" fill="rgba(34,139,34,0.45)" />
          <rect x="42" y="260" width="16" height="30" fill="rgba(139,90,43,0.55)" rx="3" />
          <circle cx="50" cy="70" r="5" fill="#FFD700" style={{ animation: "twinkle 3.2s ease-in-out 0.7s infinite alternate" }} />
          <circle cx="35" cy="150" r="4" fill="#FF4444" style={{ animation: "twinkle 2.7s ease-in-out 0.2s infinite alternate" }} />
          <circle cx="65" cy="180" r="3.5" fill="#FFD700" style={{ animation: "twinkle 3.8s ease-in-out 1.2s infinite alternate" }} />
          <circle cx="45" cy="220" r="4" fill="#4488FF" style={{ animation: "twinkle 3.3s ease-in-out 0.6s infinite alternate" }} />
        </svg>
      </div>

      {/* Центральная маленькая */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-48 hidden lg:block">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-t from-green-900/25 to-green-700/10 blur-lg opacity-50" />
        <svg viewBox="0 0 100 240" className="w-full h-full">
          <polygon points="50,20 15,110 85,110" fill="rgba(34,139,34,0.4)" />
          <polygon points="50,55 20,130 80,130" fill="rgba(34,139,34,0.45)" />
          <polygon points="50,85 25,150 75,150" fill="rgba(34,139,34,0.4)" />
          <rect x="43" y="150" width="14" height="25" fill="rgba(139,90,43,0.5)" rx="2" />
          <circle cx="50" cy="50" r="3.5" fill="#FFD700" style={{ animation: "twinkle 2.9s ease-in-out 0.4s infinite alternate" }} />
          <circle cx="35" cy="100" r="3" fill="#FF6666" style={{ animation: "twinkle 3.1s ease-in-out 0.9s infinite alternate" }} />
          <circle cx="60" cy="120" r="2.5" fill="#FFD700" style={{ animation: "twinkle 3.6s ease-in-out 0.1s infinite alternate" }} />
        </svg>
      </div>
    </div>
  );
}
