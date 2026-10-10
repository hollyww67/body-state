import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createAdminSessionToken } from "@/lib/admin-auth";
import { getAdminPasswordHash } from "@/lib/admin-credentials";
import { cleanText, getClientIp, readJsonObject } from "@/lib/request";

export async function POST(request: NextRequest) {
  const rateKey = `mobile-login:${getClientIp(request)}`;
  if (!(await checkRateLimit(rateKey, 5, 15 * 60))) return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 8_192); } catch { return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 }); }
  const username = cleanText(body.username, 120);
  const password = typeof body.password === "string" ? body.password.slice(0, 512) : "";
  const validUsername = process.env.ADMIN_USERNAME;
  const passwordHash = await getAdminPasswordHash();
  if (!validUsername || !passwordHash) return NextResponse.json({ error: "Админ-вход не настроен" }, { status: 503 });
  if (username !== validUsername || !(await bcrypt.compare(password, passwordHash))) return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });

  const token = await createAdminSessionToken();
  await resetRateLimit(rateKey);
  return NextResponse.json({ ok: true, token, expiresIn: 60 * 60 * 24 * 7 });
}
