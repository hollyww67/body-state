import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { slots } = await request.json();

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Нет слотов для добавления" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("slots").insert(slots);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: slots.length }, { status: 201 });
}
