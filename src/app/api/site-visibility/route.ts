import { NextResponse } from "next/server";
import { isShopVisible } from "@/lib/site-visibility";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { shopVisible: await isShopVisible() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
