import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();
  if (!pin || pin.length < 6) {
    return NextResponse.json({ error: "PIN должен быть от 6 цифр" }, { status: 400 });
  }

  await supabaseAdmin.from("settings").upsert(
    { key: "admin_pin_permanent", value: pin },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}
