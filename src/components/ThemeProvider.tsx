"use client";

import { useEffect } from "react";

export default function ThemeProvider() {
  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((data) => {
        if (data.theme) {
          document.documentElement.setAttribute("data-theme", data.theme);
          document.documentElement.style.setProperty("color-scheme", data.theme === "violet" ? "dark" : "light");
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
