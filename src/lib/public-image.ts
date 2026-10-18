/** Public CMS assets only; never let an arbitrary string become an image scheme. */
export function publicImageSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source || /[\u0000-\u001f\\]/.test(source)) return null;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
