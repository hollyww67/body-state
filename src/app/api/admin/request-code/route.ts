import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTelegram } from "@/lib/telegram";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  // Проверяем что уже залогинен (код запрашивается только при активной сессии)
  if (session !== "true") {
    return NextResponse.json({ error: "Сначала войдите с паролем" }, { status: 403 });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await supabaseAdmin.from("settings").upsert(
    { key: "admin_pin", value: JSON.stringify({ code, expiresAt }) },
    { onConflict: "key" }
  );

  await sendTelegram(`🔐 <b>PIN-код для входа</b>\n\n<code>${code}</code>\n\nДействителен 5 минут.`);

  return NextResponse.json({ ok: true });
}
