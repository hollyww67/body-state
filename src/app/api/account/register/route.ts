import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { accountCookie, createAccountSession } from "@/lib/account-auth";
import { validatePassword } from "@/lib/account-credentials";
import { db } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/legal";
import { cleanText, enforceRateLimit, normalizeEmail, readJsonObject } from "@/lib/request";
import { sendEmail } from "@/lib/notifications";
import { syncLoyaltyRewards } from "@/lib/loyalty";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "account-register", 6, 60 * 60);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 16_384);
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const displayName = cleanText(body.display_name, 80);
  const email = normalizeEmail(body.email);
  const { password, error: passwordError } = validatePassword(body.password);

  if (displayName.length < 2) return NextResponse.json({ error: "Укажите имя длиной не менее 2 символов" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Укажите корректный e-mail" }, { status: 400 });
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Подтвердите согласие на обработку персональных данных" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const account = await db.transaction(async (client) => {
      const result = await client.query<{ id: string; session_version: number }>(
        `INSERT INTO account_users
          (display_name, email, phone, username, password_hash, consent_version, consent_at, updated_at)
         VALUES ($1, $2, NULL, $2, $3, $4, now(), now())
         RETURNING id::text, session_version`,
        [displayName, email, passwordHash, CONSENT_VERSION],
      );
      const created = result.rows[0]!;
      return created;
    });
    const token = await createAccountSession(account.id, account.session_version);
    await syncLoyaltyRewards({ accountUserId: account.id, email });
    (await cookies()).set(accountCookie(token));
    void sendEmail(
      email,
      "Личный кабинет создан",
      `<p>Здравствуйте, ${displayName.replace(/[&<>"']/g, "")}!</p><p>Для входа используйте e-mail <strong>${email}</strong>.</p><p>Если понадобится новый пароль, воспользуйтесь ссылкой «Забыли пароль?» на странице входа.</p>`,
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Этот e-mail уже используется" }, { status: 409 });
    }
    console.error("[Account] Registration failed", error);
    return NextResponse.json({ error: "Не удалось создать аккаунт" }, { status: 500 });
  }
}
