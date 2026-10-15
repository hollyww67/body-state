import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { enforceRateLimit, readJsonObject } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { maxEnabled } from "@/lib/max-notifications";
import { createMaxAdminPairing, getMaxAdminBinding, confirmMaxAdminBinding, revokeMaxAdminBinding } from "@/lib/max-admin-binding";

export const runtime = "nodejs";
async function handle(request: NextRequest, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!maxEnabled()) return reply({ error: "MAX недоступен" }, 503);
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    if (method !== "GET" && (request.headers.get("origin") !== request.nextUrl.origin
      || request.headers.get("sec-fetch-site") === "cross-site")) return reply({ error: "Недопустимый источник" }, 403);
    const limited = await enforceRateLimit(request, "max-admin-binding", 30, 300);
    if (limited) return limited;
    if (method === "GET") return reply(await getMaxAdminBinding());
    if (!await checkRateLimit("max-admin-binding-global", 20, 300)) return reply({ error: "Попробуйте позже" }, 429);
    if (method === "POST") return reply(await createMaxAdminPairing());
    if (method === "DELETE") { await revokeMaxAdminBinding(); return reply({ ok: true }); }
    let body;
    try { body = await readJsonObject(request, 1024); }
    catch { return reply({ error: "Некорректный запрос" }, 400); }
    const confirmed = await confirmMaxAdminBinding(body.maxUserId, body.maxChatId);
    return confirmed ? reply({ ok: true }) : reply({ error: "Привязка не найдена или истекла" }, 409);
  } catch { return reply({ error: "MAX временно недоступен" }, 503); }
}
export async function GET(request: NextRequest) { return handle(request, "GET"); }
export async function POST(request: NextRequest) { return handle(request, "POST"); }
export async function PATCH(request: NextRequest) { return handle(request, "PATCH"); }
export async function DELETE(request: NextRequest) { return handle(request, "DELETE"); }
