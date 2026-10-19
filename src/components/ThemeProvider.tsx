"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getServerThemeSnapshot, getThemeSnapshot, subscribeTheme } from "@/lib/theme";

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
}

export default function ThemeProvider() {
  useEffect(() => subscribeTheme(() => {}), []);

  return null;
}
