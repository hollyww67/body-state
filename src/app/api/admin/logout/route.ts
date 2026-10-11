import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, revokeAdminSessionToken } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
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

  return NextResponse.redirect(new URL("/login", request.url));
}
