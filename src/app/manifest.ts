import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Через тело к состоянию",
    short_name: "Через тело",
    description: "Бережная социально-психологическая и физическая реабилитация",
    start_url: "/",
    display: "standalone",
    background_color: "#08050F",
    theme_color: "#7C3AED",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
