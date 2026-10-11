import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, revokeAccountSession } from "@/lib/account-auth";

export async function POST(request: NextRequest) {
  await revokeAccountSession(request);
  (await cookies()).set({ name: ACCOUNT_COOKIE, value: "", path: "/", httpOnly: true, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
