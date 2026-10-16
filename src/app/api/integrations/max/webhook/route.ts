import { NextRequest, NextResponse } from "next/server";
import { acceptMaxUpdate, maxEnabled, parseMaxUpdate, readMaxUpdate, validMaxSecret } from "@/lib/max-notifications";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!maxEnabled()) return NextResponse.json({ error: "MAX disabled" }, { status: 503 });
  if (!validMaxSecret(request.headers.get("x-max-bot-api-secret"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let update;
  try { update = parseMaxUpdate(await readMaxUpdate(request)); }
  catch (error) { return NextResponse.json({ error: "Invalid update" }, { status: error instanceof Error && error.message === "MAX_TOO_LARGE" ? 413 : 400 }); }
  try {
    await acceptMaxUpdate(update);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Temporary failure" }, { status: 503 }); }
}
