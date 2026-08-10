import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ valid: false });
  }

  const { data } = await supabaseAdmin
    .from("psychology_bookings")
    .select("id")
    .eq("room_id", id)
    .eq("status", "confirmed")
    .single();

  return NextResponse.json({ valid: !!data });
}
