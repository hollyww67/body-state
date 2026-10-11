import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  // Elapsed time is not evidence of attendance. Keep cron compatibility;
  // administrators explicitly confirm attendance in the booking card.
  return NextResponse.json({ ok: true, count: 0, mode: "manual_attendance" });
}
