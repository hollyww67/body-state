import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin.from("blog_posts").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ posts: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, title, excerpt, content, image, published } = body;

  if (!slug || !title) {
    return NextResponse.json({ error: "slug и title обязательны" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("blog_posts").insert({
    slug, title, excerpt: excerpt || "", content: content || "", image: image || null, published: published ?? false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { slug, title, excerpt, content, image, published } = body;

  if (!slug) return NextResponse.json({ error: "slug обязателен" }, { status: 400 });

  const updates: any = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (excerpt !== undefined) updates.excerpt = excerpt;
  if (content !== undefined) updates.content = content;
  if (image !== undefined) updates.image = image;
  if (published !== undefined) updates.published = published;

  const { error } = await supabaseAdmin.from("blog_posts").update(updates).eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug обязателен" }, { status: 400 });
  await supabaseAdmin.from("blog_posts").delete().eq("slug", slug);
  return NextResponse.json({ ok: true });
}
