import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifyAdminSessionToken(session)) {
    return NextResponse.json({ authenticated: true });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
