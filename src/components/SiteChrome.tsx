"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import { AnimatedBackground, Snowfall } from "@/components/LazyComponents";

export default function SiteChrome() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname === "/login" || pathname === "/psychology/room" || pathname.startsWith("/psychology-room/")) return null;

  return (
    <>
      <AnimatedBackground />
      <Snowfall />
      <Footer />
    </>
  );
}
