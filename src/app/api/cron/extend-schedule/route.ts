import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { extendSchedule } from "@/lib/schedule-management";

/**
 * Keeps a rolling booking horizon when called once a week. Every Sunday the
 * next seven farthest days (+30 through +36) copy the service/time pattern
 * from the same weekdays four weeks earlier.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await extendSchedule(request.nextUrl.searchParams.get('dry_run')==='true'));
  } catch (error) {
    console.error("[Cron extend-schedule] Failed", error);
    return NextResponse.json({ error: "Не удалось продлить расписание" }, { status: 500 });
  }
}
