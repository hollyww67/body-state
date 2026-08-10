import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (token) {
    await supabaseAdmin.from("push_tokens").delete().eq("token", token);
  }
  return NextResponse.json({ ok: true });
}
