import { NextRequest, NextResponse } from "next/server";
import {
  isPublicAdminApiPath,
  requireAdmin,
} from "@/lib/admin-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin") && !isPublicAdminApiPath(pathname)) {
    const authError = await requireAdmin(request);
    if (authError) return authError;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
