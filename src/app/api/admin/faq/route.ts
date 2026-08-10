import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("faq_answers").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ faqs: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { error } = await supabaseAdmin.from("faq_answers").insert(body);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id, is_active } = await request.json();
  await supabaseAdmin.from("faq_answers").update({ is_active }).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  await supabaseAdmin.from("faq_answers").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
