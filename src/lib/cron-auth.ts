import { NextRequest, NextResponse } from "next/server";

/** Protects cron endpoints. Set CRON_SECRET in env; callers send Authorization: Bearer <secret>. */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const provided = bearer || headerSecret;

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
