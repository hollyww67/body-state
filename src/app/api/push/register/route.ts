import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanText, enforceRateLimit, readJsonObject } from "@/lib/request";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const limited = await enforceRateLimit(request, "push-register", 20, 60 * 60);
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8_192); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const token = cleanText(body.token, 4096);
  if (!token) return NextResponse.json({ error: "Токен обязателен" }, { status: 400 });
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) return NextResponse.json({ error: "Некорректный push-токен" }, { status: 400 });

  await db.from("push_tokens").upsert({ token }, { onConflict: "token" });
  return NextResponse.json({ ok: true });
}
