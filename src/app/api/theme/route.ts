import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { data } = await db.from("settings").select("value").eq("key", "theme").single();
  return NextResponse.json({ theme: data?.value || "teal" });
}
