import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "admin_pin_permanent").single();
  return NextResponse.json({ hasPin: !!data?.value });
}
