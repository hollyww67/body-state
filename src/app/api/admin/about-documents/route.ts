import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { data, error } = await db.from("about_documents").select("*").order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  const title = String(body.title || "").trim().slice(0, 160);
  const imageUrl = String(body.image_url || "").trim();
  if (!title || !/^\/(uploads|media\/images)\/[a-zA-Z0-9._-]+$/.test(imageUrl)) return NextResponse.json({ error: "Добавьте название и корректное изображение" }, { status: 400 });
  const { data: existing } = await db.from("about_documents").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const nextOrder = Number(existing?.[0]?.sort_order || 0) + 10;
  const { data, error } = await db.from("about_documents").insert({ title, image_url: imageUrl, sort_order: nextOrder }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан документ" }, { status: 400 });
  const { data, error } = await db.from("about_documents").delete().eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
