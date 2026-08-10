import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, { status: 429 });
  }

  const { username, password } = await request.json();
  const validUsername = process.env.ADMIN_USERNAME || "AA111";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";

  if (username !== validUsername || !bcrypt.compareSync(password, passwordHash)) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_session", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}
