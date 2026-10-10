import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/account-auth";
import { validatePassword } from "@/lib/account-credentials";
import { db } from "@/lib/db";
import { enforceRateLimit, readJsonObject } from "@/lib/request";

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "account-password-reset-confirm", 10, 15 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 8_192);
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const { password, error: passwordError } = validatePassword(body.password);
  const confirmation = String(body.password_confirmation ?? "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({ error: "Ссылка недействительна или устарела" }, { status: 400 });
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  if (password !== confirmation) return NextResponse.json({ error: "Пароли не совпадают" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  const changed = await db.transaction(async (client) => {
    const found = await client.query<{ id: string; account_user_id: string }>(
      `SELECT id::text, account_user_id::text
         FROM account_password_reset_tokens
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [digest(token)],
    );
    const reset = found.rows[0];
    if (!reset) return false;
    const updated = await client.query(
      `UPDATE account_users
          SET password_hash=$2, verified_at=COALESCE(verified_at, now()), session_version=session_version+1, updated_at=now()
        WHERE id=$1 AND disabled_at IS NULL`,
      [reset.account_user_id, passwordHash],
    );
    if (updated.rowCount !== 1) return false;
    await client.query("UPDATE account_password_reset_tokens SET used_at=now() WHERE account_user_id=$1 AND used_at IS NULL", [reset.account_user_id]);
    return true;
  });

  if (!changed) return NextResponse.json({ error: "Ссылка недействительна или устарела" }, { status: 400 });
  (await cookies()).set({ name: ACCOUNT_COOKIE, value: "", path: "/", httpOnly: true, maxAge: 0 });
  return NextResponse.json({ ok: true, message: "Пароль обновлён. Теперь войдите с новым паролем." });
}
