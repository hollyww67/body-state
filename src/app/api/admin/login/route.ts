import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { adminSessionCookieOptions, createAdminSessionToken } from "@/lib/admin-auth";
import { getAdminPasswordHash } from "@/lib/admin-credentials";
import { cleanText, getClientIp, readJsonObject } from "@/lib/request";

export async function POST(request: NextRequest) {
  const rateKey = `login:${getClientIp(request)}`;
  if (!(await checkRateLimit(rateKey, 5, 15 * 60))) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429, headers: { "Retry-After": "900" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 8_192);
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса" }, { status: 400 });
  }

  const username = cleanText(body.username, 120);
  const password = typeof body.password === "string" ? body.password.slice(0, 512) : "";
  if (!username || !password) return NextResponse.json({ error: "Логин и пароль обязательны" }, { status: 400 });

  const validUsername = process.env.ADMIN_USERNAME;
  const passwordHash = await getAdminPasswordHash();
  if (!validUsername || !passwordHash) {
    console.error("[admin/login] ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set");
    return NextResponse.json({ error: "Админ-вход не настроен" }, { status: 503 });
  }

  const passwordMatches = await bcrypt.compare(password, passwordHash);
  if (username !== validUsername || !passwordMatches) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  await resetRateLimit(rateKey);
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieOptions(token));
  return NextResponse.json({ ok: true });
}
