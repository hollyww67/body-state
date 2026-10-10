import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { theme } = await request.json();

  await db.from("settings").upsert({ key: "theme", value: theme }, { onConflict: "key" });

  return NextResponse.json({ ok: true });
}
