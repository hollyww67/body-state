import { NextRequest, NextResponse } from "next/server";
import { getAccountSession } from "@/lib/account-auth";
import { enforceRateLimit } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { createMaxPairing, maxEnabled, unlinkMax } from "@/lib/max-notifications";

export const runtime = "nodejs";
async function handle(request: NextRequest, unlink: boolean) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!maxEnabled()) return reply({ error: "MAX недоступен" }, 503);
  // Cookie-authenticated mutations must originate from this site.
  if (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Недопустимый источник" }, 403);
  try {
    const session = await getAccountSession(request);
    if (!session) return reply({ error: "Требуется вход" }, 401);
    const limited = await enforceRateLimit(request, "max-pair", 20, 900);
    if (limited) return limited;
    if (!await checkRateLimit(`max-pair-account:${session.userId}`, 5, 900)) return reply({ error: "Попробуйте позже" }, 429);
    if (unlink) { await unlinkMax(session.userId); return reply({ ok: true }); }
    return reply(await createMaxPairing(session.userId));
  } catch { return reply({ error: "MAX временно недоступен" }, 503); }
}
export async function POST(request: NextRequest) { return handle(request, false); }
export async function DELETE(request: NextRequest) { return handle(request, true); }
