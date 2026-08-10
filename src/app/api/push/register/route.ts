import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Токен обязателен" }, { status: 400 });

  await supabaseAdmin.from("push_tokens").upsert({ token }, { onConflict: "token" });
  return NextResponse.json({ ok: true });
}
