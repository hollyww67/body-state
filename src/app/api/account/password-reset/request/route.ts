import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { assertResetKeyConfigured, enqueuePasswordReset, resetNotificationsEnabled } from "@/lib/notification-reset";
import { isEmailConfigured, sendEmail } from "@/lib/notifications";
import { cleanText, enforceRateLimit, readJsonObject } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://body-state.ru";
const GENERIC_MESSAGE = "Если аккаунт найден, вы получите письмо для восстановления.";

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "account-password-reset", 5, 60 * 60);
  if (limited) return limited;
  const queued = resetNotificationsEnabled();
  if (queued) {
    try { assertResetKeyConfigured(); }
    catch { return NextResponse.json({ error: "Восстановление временно недоступно. Обратитесь в поддержку." }, { status: 503 }); }
  }
  if (!queued && !isEmailConfigured()) {
    return NextResponse.json({ error: "Отправка писем пока не настроена. Обратитесь в поддержку." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 4_096);
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const identity = cleanText(body.identity, 254).normalize("NFKC").toLowerCase();
  if (identity.length < 3) return NextResponse.json({ error: "Введите логин или e-mail" }, { status: 400 });
  if (!(await checkRateLimit(`account-password-reset-target:${digest(identity)}`, 3, 60 * 60))) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  if (queued) {
    try {
      await db.transaction(client => enqueuePasswordReset(client, identity));
    } catch {
      // No identity, reset URL, token, SQL parameters or provider response in logs.
      console.error("[Account] Password reset queue unavailable");
      return NextResponse.json({ error: "Восстановление временно недоступно. Попробуйте позже." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const result = await pool.query<{ id: string; username: string; email: string | null; display_name: string | null }>(
    `SELECT id::text, username, email, display_name
       FROM account_users
      WHERE disabled_at IS NULL AND (lower(username)=$1 OR lower(email)=$1)
      LIMIT 1`,
    [identity],
  );
  const account = result.rows[0];

  if (account?.email) {
    await pool.query("DELETE FROM account_password_reset_tokens WHERE expires_at < now() - interval '7 days' OR used_at < now() - interval '7 days'");
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = digest(token);
    await pool.query("UPDATE account_password_reset_tokens SET used_at=now() WHERE account_user_id=$1 AND used_at IS NULL", [account.id]);
    await pool.query(
      "INSERT INTO account_password_reset_tokens (account_user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '30 minutes')",
      [account.id, tokenHash],
    );
    const resetUrl = new URL("/account/reset-password", SITE_URL);
    resetUrl.searchParams.set("token", token);
    const sent = await sendEmail(
      account.email,
      "Восстановление пароля",
      `<p>Здравствуйте${account.display_name ? `, ${escapeHtml(account.display_name)}` : ""}!</p><p>Для аккаунта <strong>${escapeHtml(account.username)}</strong> запрошена смена пароля.</p><p><a href="${resetUrl.toString()}">Установить новый пароль</a></p><p>Ссылка действует 30 минут и может быть использована один раз. Если это были не вы, проигнорируйте письмо.</p>`,
    );
    if (!sent) {
      await pool.query("UPDATE account_password_reset_tokens SET used_at=now() WHERE token_hash=$1", [tokenHash]);
      console.error("[Account] Password reset email delivery failed");
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
