import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { ids } = await request.json();
  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids обязателен" }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i++) {
    await db.from("products").update({ sort_order: i + 1 }).eq("id", ids[i]);
  }

  return NextResponse.json({ ok: true });
}
