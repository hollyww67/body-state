"use client";

import { useEffect, useMemo, useState } from "react";
import { getPageDefaults, type EditablePage } from "@/lib/editable-pages";

type PageCopy = Record<string, string>;

function parsePageCopy(content: unknown): PageCopy {
  if (!content) return {};
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const source = record.copy && typeof record.copy === "object" ? record.copy as Record<string, unknown> : record;
    return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return {}; }
}

export function usePageCopy(slug: EditablePage["slug"]): PageCopy {
  const defaults = useMemo(() => getPageDefaults(slug), [slug]);
  const [copy, setCopy] = useState<PageCopy>(defaults);

  useEffect(() => {
    let active = true;
    fetch(`/api/page-content/${encodeURIComponent(slug)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && data?.is_active !== false) setCopy({ ...defaults, ...parsePageCopy(data?.content) });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [defaults, slug]);

  return copy;
}
