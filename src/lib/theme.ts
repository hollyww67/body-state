export type Theme = "emerald-light" | "chocolate-dark";

export const DEFAULT_THEME: Theme = "emerald-light";
export const THEME_STORAGE_KEY = "theme";

// Self-contained pure mapping, shared with the before-paint bootstrap.
// A present canonical key always wins, including an unrecognized value.
export function resolveTheme(canonical: string | null, legacy: string | null): Theme {
  switch (canonical === null ? legacy : canonical) {
    case "chocolate-dark":
    case "violet":
    case "ironman":
      return "chocolate-dark";
    case "emerald-light":
    case "teal":
    case "light":
    case "newyear":
    default:
      return "emerald-light";
  }
}

function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-admin-theme", theme);
  root.style.colorScheme = theme === "chocolate-dark" ? "dark" : "light";
}

function readStoredTheme(resolve: typeof resolveTheme): Theme {
  let canonical: string | null = null;
  let legacy: string | null = null;
  try {
    canonical = localStorage.getItem("theme");
    if (canonical === null) legacy = localStorage.getItem("admin-theme");
  } catch { /* Storage may be disabled. */ }
  const theme = resolve(canonical, legacy);
  try { localStorage.setItem("theme", theme); } catch { /* Keep an in-memory choice. */ }
  return theme;
}

// Initializes the document once; installs no competing listeners or async work.
export const THEME_BOOTSTRAP = `(()=>{const theme=(${readStoredTheme.toString()})(${resolveTheme.toString()});(${applyThemeToDocument.toString()})(theme)})()`;

let currentTheme: Theme | null = null;
const listeners = new Set<() => void>();

function updateThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  if (!color || !CSS.supports("color", color)) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function publish(theme: Theme) {
  currentTheme = theme;
  applyThemeToDocument(theme);
  updateThemeColor();
  listeners.forEach((listener) => listener());
}

function initializeTheme() {
  if (currentTheme !== null) return;
  const initial = document.documentElement.getAttribute("data-theme");
  publish(initial === "emerald-light" || initial === "chocolate-dark"
    ? initial : readStoredTheme(resolveTheme));
}

function onStorage(event: StorageEvent) {
  if (event.storageArea !== null) {
    try { if (event.storageArea !== localStorage) return; } catch { return; }
  }
  if (event.key === THEME_STORAGE_KEY || event.key === null) {
    publish(resolveTheme(event.key === null ? null : event.newValue, null));
  }
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  initializeTheme();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function getThemeSnapshot(): Theme {
  if (currentTheme !== null) return currentTheme;
  if (typeof document !== "undefined") {
    return resolveTheme(document.documentElement.getAttribute("data-theme"), null);
  }
  return DEFAULT_THEME;
}

export function getServerThemeSnapshot(): Theme { return DEFAULT_THEME; }

// Settings can distinguish a persisted choice from a blocked storage write.
export function setTheme(theme: Theme): boolean {
  let persisted = true;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { persisted = false; }
  publish(theme);
  return persisted;
}

export function toggleTheme() {
  setTheme(getThemeSnapshot() === "emerald-light" ? "chocolate-dark" : "emerald-light");
}
