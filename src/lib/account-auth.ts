import crypto from "crypto";
import { NextRequest } from "next/server";
import { cacheDelete, cacheGet, cacheSet } from "@/lib/redis";
import { pool } from "@/lib/db";

export const ACCOUNT_COOKIE = "account_session";
const SESSION_TTL = 7 * 24 * 60 * 60;

export async function createAccountSession(userId: string, sessionVersion?: number) {
  const version = sessionVersion || Number((await pool.query<{ session_version: number }>(
    "SELECT session_version FROM account_users WHERE id=$1 AND disabled_at IS NULL LIMIT 1",
    [userId],
  )).rows[0]?.session_version || 1);
  const token = crypto.randomBytes(32).toString("base64url");
  await cacheSet(`account-session:${token}`, JSON.stringify({ userId, sessionVersion: version }), SESSION_TTL);
  return token;
}

export async function getAccountSession(request: NextRequest) {
  const token = request.cookies.get(ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const raw = await cacheGet(`account-session:${token}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { userId?: unknown; sessionVersion?: unknown };
    if (typeof session.userId !== "string") return null;
    const account = await pool.query<{ session_version: number }>(
      "SELECT session_version FROM account_users WHERE id=$1 AND disabled_at IS NULL LIMIT 1",
      [session.userId],
    );
    if (!account.rows[0]) return null;
    const storedVersion = typeof session.sessionVersion === "number" ? session.sessionVersion : 1;
    return storedVersion === Number(account.rows[0].session_version) ? { userId: session.userId } : null;
  } catch {
    return null;
  }
}

export async function revokeAccountSession(request: NextRequest) {
  const token = request.cookies.get(ACCOUNT_COOKIE)?.value;
  if (token) await cacheDelete(`account-session:${token}`);
}

export function accountCookie(token: string) {
  return {
    name: ACCOUNT_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL,
  };
}
