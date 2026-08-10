import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { service_type, slot_time } = await request.json();

  if (!["bfm", "brt", "psychology"].includes(service_type)) {
    return NextResponse.json({ error: "Неверный тип услуги" }, { status: 400 });
  }

  if (!slot_time) {
    return NextResponse.json({ error: "Укажите время" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("slots").insert({
    service_type,
    slot_time,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
