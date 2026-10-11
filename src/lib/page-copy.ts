import { db } from "@/lib/db";
import { getPageDefaults } from "@/lib/editable-pages";

export type PageCopy = Record<string, string>;

export function parsePageCopy(content: unknown): PageCopy {
  if (!content) return {};
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const source = "copy" in parsed && parsed.copy && typeof parsed.copy === "object" ? parsed.copy : parsed;
    return Object.fromEntries(Object.entries(source as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export async function getPageCopy(slug: string): Promise<PageCopy> {
  const defaults = getPageDefaults(slug);
  try {
    const { data } = await db.from<{ content: string; is_active: boolean }>("page_content").select("content,is_active").eq("slug", slug).maybeSingle();
    if (!data?.is_active) return defaults;
    return { ...defaults, ...parsePageCopy(data.content) };
  } catch {
    return defaults;
  }
}
