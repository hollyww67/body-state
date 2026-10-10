import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { accountCookie, createAccountSession } from "@/lib/account-auth";
import { pool } from "@/lib/db";
import { enforceRateLimit, normalizeEmail, readJsonObject } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

const DUMMY_PASSWORD_HASH = "$2b$12$gi1hp8wfmTCsT3P.xEiFH.F0mVAOMyPAKpAzByYV6l6SfTFdlLHRu";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "account-login", 10, 15 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 8_192);
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email = normalizeEmail(body.username);
  const password = String(body.password ?? "").slice(0, 256);
  if (!email) return NextResponse.json({ error: "Укажите корректный e-mail" }, { status: 400 });
  const usernameKey = crypto.createHash("sha256").update(email).digest("hex");
  if (!(await checkRateLimit(`account-login-user:${usernameKey}`, 8, 15 * 60))) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429, headers: { "Retry-After": "900" } });
  }

  const result = await pool.query<{ id: string; password_hash: string | null; disabled_at: Date | null; session_version: number }>(
    "SELECT id::text, password_hash, disabled_at, session_version FROM account_users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );
  const account = result.rows[0];
  const valid = await bcrypt.compare(password, account?.password_hash || DUMMY_PASSWORD_HASH);

  if (!account || !valid || account.disabled_at) {
    return NextResponse.json({ error: "Неверный e-mail или пароль" }, { status: 401 });
  }

  await pool.query("UPDATE account_users SET last_login_at=now(), updated_at=now() WHERE id=$1", [account.id]);
  const token = await createAccountSession(account.id, account.session_version);
  (await cookies()).set(accountCookie(token));
  return NextResponse.json({ ok: true });
}
