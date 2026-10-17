import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, revokeAdminSessionToken } from "@/lib/admin-auth";

export async function POST() {
  const cookieStore = await cookies();
  await revokeAdminSessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
  cookieStore.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookieStore.delete(ADMIN_COOKIE);
  cookieStore.delete("admin_token");

  // The caller navigates after revocation. A redirect here makes fetch follow
  // the proxy's internal origin (and preserves POST with a default 307).
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
