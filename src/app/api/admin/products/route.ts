import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin.from("products").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ products: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, slug, description, composition, price, stock, volume_ml, images, category, subcategory } = body;
  const { error } = await supabaseAdmin.from("products").insert({
    name, slug, description, composition, price, stock, volume_ml: volume_ml || null, images: images || [], category: category || "care", subcategory: subcategory || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const body = await request.json();
  const { name, slug, description, composition, price, stock, volume_ml, images, category, subcategory } = body;
  await supabaseAdmin.from("products").update({
    name, slug, description, composition, price, stock, volume_ml: volume_ml || null, images: images || [], category: category || "care", subcategory: subcategory || null,
  }).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  await supabaseAdmin.from("products").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
