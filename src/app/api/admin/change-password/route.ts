import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieOptions,
  createAdminSessionToken,
  requireAdmin,
  rotateAdminSessionVersion,
} from "@/lib/admin-auth";
import { getAdminPasswordHash, setAdminPasswordHash } from "@/lib/admin-credentials";
import { enforceRateLimit, readJsonObject } from "@/lib/request";

function passwordProblem(password: string) {
  if (password.length < 6) return "Новый пароль должен содержать не менее 6 символов";
  if (password.length > 512) return "Пароль слишком длинный";
  return "";
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const limited = await enforceRateLimit(request, "admin-change-password", 5, 60 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 4_096);
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  if (!currentPassword || !newPassword || !confirmation) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }
  if (newPassword !== confirmation) {
    return NextResponse.json({ error: "Новые пароли не совпадают" }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const currentHash = await getAdminPasswordHash();
  if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
    return NextResponse.json({ error: "Текущий пароль указан неверно" }, { status: 401 });
  }
  if (await bcrypt.compare(newPassword, currentHash)) {
    return NextResponse.json({ error: "Новый пароль должен отличаться от текущего" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await setAdminPasswordHash(passwordHash);
  await rotateAdminSessionVersion();
  const token = await createAdminSessionToken();
  (await cookies()).set(adminSessionCookieOptions(token));
  return NextResponse.json({ ok: true, message: "Пароль обновлён. Остальные сеансы завершены." });
}
