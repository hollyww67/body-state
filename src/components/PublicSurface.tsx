"use client";

import { usePathname } from "next/navigation";

/** Scope public typography/geometry away from the existing admin and video UI. */
export default function PublicSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const operational = pathname.startsWith("/admin") || pathname === "/login" || pathname === "/psychology/room" || pathname.startsWith("/psychology-room/");
  return operational ? children : <div className="quiet-public">{children}</div>;
}
