import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get("service_type");

  if (!serviceType || !["bfm", "brt", "psychology"].includes(serviceType)) {
    return NextResponse.json({ error: "Укажите корректный тип услуги" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("slots")
    .select("*")
    .eq("service_type", serviceType)
    .eq("is_booked", false)
    .gte("slot_time", now)
    .order("slot_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data || [] });
}
