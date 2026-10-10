"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Choice = "accepted" | "essential" | null;
export default function UmamiScript() {
  const pathname = usePathname();
  const isAdmin = pathname === "/login" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/psychology/room" || pathname.startsWith("/psychology-room/");
  const [choice, setChoice] = useState<Choice>(null);
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_ID;
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;

  useEffect(() => { try {const saved = localStorage.getItem("privacy-analytics"); if (saved === "accepted" || saved === "essential") setChoice(saved);}catch{setChoice('essential');} }, []);
  useEffect(() => {
    if (isAdmin || choice !== "accepted" || !websiteId || !src || document.querySelector("script[data-website-id]")) return;
    const script = document.createElement("script"); script.defer = true; script.src = src; script.referrerPolicy='no-referrer'; script.dataset.websiteId = websiteId; script.dataset.domains = "body-state.ru"; script.dataset.autoTrack='false'; document.head.appendChild(script);
  }, [choice, src, websiteId, isAdmin]);
  const save = (value: Exclude<Choice, null>) => { try{localStorage.setItem("privacy-analytics", value);setChoice(value);}catch{setChoice('essential');} };
  if (choice || isAdmin) return null;
  return <aside className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-2xl rounded-3xl border p-5 shadow-2xl" style={{ background: "var(--bg)", borderColor: "var(--glass-border)", color: "var(--foreground)" }} aria-label="Настройки аналитики">
    <p className="font-semibold">Настройки конфиденциальности</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>Необязательная аналитика помогает улучшать сайт и включается только с вашего разрешения. <Link href="/privacy" className="underline">Подробнее</Link></p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => save("accepted")} className="liquid-btn rounded-full px-5 py-2.5 text-sm font-semibold text-white">Разрешить аналитику</button><button type="button" onClick={() => save("essential")} className="rounded-full border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Только необходимое</button></div>
  </aside>;
}
