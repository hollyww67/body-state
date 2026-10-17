import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { isShopVisible } from "@/lib/site-visibility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ shopVisible: await isShopVisible() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("shopVisible" in body) || typeof body.shopVisible !== "boolean") {
    return NextResponse.json({ error: "shopVisible должен быть boolean" }, { status: 400 });
  }

  const shopVisible = body.shopVisible;
  const { error } = await db.from("settings").upsert({
    key: "shop_visible",
    value: shopVisible ? "true" : "false",
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Не удалось сохранить настройку" }, { status: 500 });
  return NextResponse.json({ shopVisible }, { headers: { "Cache-Control": "no-store" } });
}
