"use client";

import { useEffect } from "react";

export default function ThemeProvider() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "teal" || savedTheme === "violet") {
      document.documentElement.setAttribute("data-theme", savedTheme);
      document.documentElement.style.colorScheme = savedTheme === "violet" ? "dark" : "light";
      return;
    }

    fetch("/api/theme")
      .then((r) => r.json())
      .then((data) => {
        const theme = data.theme === "violet" ? "violet" : "teal";
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.style.colorScheme = theme === "violet" ? "dark" : "light";
      })
      .catch(() => {});
  }, []);

  return null;
}
