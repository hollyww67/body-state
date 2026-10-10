import { NextRequest, NextResponse } from "next/server";
import { cacheDelete, cacheGet, cacheSet } from "./redis";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const ADMIN_SESSION_VERSION_KEY = "admin-session-version";

const PUBLIC_ADMIN_PATHS = new Set([
  "/api/admin/login",
  "/api/admin/mobile-login",
  "/api/admin/logout",
]);

export async function createAdminSessionToken(): Promise<string> {
  const token = crypto.randomUUID();
  const version = await getAdminSessionVersion();
  await cacheSet(`admin-session:${token}`, version, ADMIN_SESSION_MAX_AGE);
  return token;
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [sessionVersion, currentVersion] = await Promise.all([
    cacheGet(`admin-session:${token}`),
    getAdminSessionVersion(),
  ]);
  return Boolean(sessionVersion && sessionVersion === currentVersion);
}

async function getAdminSessionVersion() {
  return await cacheGet(ADMIN_SESSION_VERSION_KEY) || "1";
}

export async function rotateAdminSessionVersion() {
  const version = crypto.randomUUID();
  await cacheSet(ADMIN_SESSION_VERSION_KEY, version, ADMIN_SESSION_MAX_AGE * 2);
  return version;
}

export async function revokeAdminSessionToken(token: string | undefined | null) {
  if (token) await cacheDelete(`admin-session:${token}`);
}

export function isPublicAdminApiPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.has(pathname);
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const cookieToken = request.cookies.get(ADMIN_COOKIE)?.value;
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || cookieToken;
  if (await verifyAdminSessionToken(token)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function adminSessionCookieOptions(token: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  };
}
