import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Через тело к состоянию — Админка",
    short_name: "Админка",
    description: "Панель управления",
    start_url: "/admin",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F766E",
    orientation: "portrait-primary",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
