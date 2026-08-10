import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { theme } = await request.json();

  await supabaseAdmin.from("settings").upsert({ key: "theme", value: theme }, { onConflict: "key" });

  return NextResponse.json({ ok: true });
}
