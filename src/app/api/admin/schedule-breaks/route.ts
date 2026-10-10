import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createScheduleBreak, deleteScheduleBreak } from "@/lib/slots";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { data, error } = await db.from("schedule_breaks").select("*").gte("ends_at", new Date().toISOString()).order("starts_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ breaks: data || [] });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await request.json();
  const startsAt = new Date(String(body.starts_at || ""));
  const endsAt = new Date(String(body.ends_at || ""));
  const reason = String(body.reason || "Перерыв").trim().slice(0, 200) || "Перерыв";
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return NextResponse.json({ error: "Проверьте начало и окончание перерыва" }, { status: 400 });
  if (startsAt <= new Date()) return NextResponse.json({ error: "Перерыв должен начинаться в будущем" }, { status: 400 });
  if (endsAt.getTime() - startsAt.getTime() > 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Один перерыв не может быть длиннее 7 дней" }, { status: 400 });
  const result = await createScheduleBreak({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ break: result.scheduleBreak }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан перерыв" }, { status: 400 });
  const result = await deleteScheduleBreak(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
