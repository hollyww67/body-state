import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin.from("page_content").select("*").order("slug");
  return NextResponse.json({ pages: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, title, content } = body;

  if (!slug || !title) {
    return NextResponse.json({ error: "slug и title обязательны" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("page_content").insert({
    slug,
    title,
    content: content || "",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { slug, title, content } = body;

  if (!slug) return NextResponse.json({ error: "slug обязателен" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("page_content")
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) return NextResponse.json({ error: "slug обязателен" }, { status: 400 });

  await supabaseAdmin.from("page_content").delete().eq("slug", slug);

  return NextResponse.json({ ok: true });
}
