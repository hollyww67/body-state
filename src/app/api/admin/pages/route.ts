import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { editablePages, managedPages } from "@/lib/editable-pages";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { data, error } = await db.from("page_content").select("*").order("slug");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data || [];
  const bySlug = new Map(rows.map((row) => [String(row.slug), row]));
  const catalog = editablePages.map((page) => ({ ...page, record: bySlug.get(page.slug) || null }));
  const catalogSlugs = new Set(editablePages.map((page) => page.slug));
  return NextResponse.json({ catalog, managed: managedPages, custom: rows.filter((row) => !catalogSlugs.has(String(row.slug))) });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  const slug = String(body.slug || "").trim().toLowerCase();
  const title = String(body.title || "").trim();
  if (!/^[a-z0-9-]+$/.test(slug) || !title) return NextResponse.json({ error: "Укажите корректные slug и заголовок" }, { status: 400 });
  const { error } = await db.from("page_content").insert({ slug, title, content: String(body.content || ""), meta_description: String(body.meta_description || ""), meta_keywords: String(body.meta_keywords || ""), is_active: body.is_active !== false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  const slug = String(body.slug || "").trim().toLowerCase();
  const title = String(body.title || "").trim();
  if (!/^[a-z0-9-]+$/.test(slug) || !title) return NextResponse.json({ error: "Укажите корректные slug и заголовок" }, { status: 400 });
  const payload = { slug, title, content: String(body.content || ""), meta_description: String(body.meta_description || ""), meta_keywords: String(body.meta_keywords || ""), is_active: body.is_active !== false, updated_at: new Date().toISOString() };
  const { error } = await db.from("page_content").upsert(payload, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug обязателен" }, { status: 400 });
  const { error } = await db.from("page_content").delete().eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
