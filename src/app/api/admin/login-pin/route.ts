import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();
  if (!pin) return NextResponse.json({ error: "PIN обязателен" }, { status: 400 });

  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "admin_pin_permanent").single();
  if (!data?.value) return NextResponse.json({ error: "PIN не установлен" }, { status: 401 });
  if (data.value !== pin) return NextResponse.json({ error: "Неверный PIN" }, { status: 401 });

  const cookieStore = await cookies();
  cookieStore.set("admin_session", "true", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}
