import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "theme").single();
  return NextResponse.json({ theme: data?.value || "teal" });
}
