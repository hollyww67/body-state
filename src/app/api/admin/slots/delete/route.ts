import { NextRequest, NextResponse } from "next/server";
import { deleteUnreferencedSlots } from "@/lib/slot-deletion";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await deleteUnreferencedSlots(body?.ids);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, count: result.count });
  } catch (e) {
    console.error("DELETE slots error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "id не указан" }, { status: 400 });
    }

    const result = await deleteUnreferencedSlots([id]);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, count: result.count });
  } catch (e) {
    console.error("DELETE slot error:", e instanceof Error ? e.message : "Unknown error");
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
