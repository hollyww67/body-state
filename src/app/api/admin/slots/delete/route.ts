import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids || [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids не указаны" }, { status: 400 });
    }

    // Удаление пачками по 200
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      const { error } = await supabaseAdmin.from("slots").delete().in("id", batch);
      if (error) throw error;
      deleted += batch.length;
    }

    return NextResponse.json({ success: true, count: deleted });
  } catch (e: any) {
    console.error("DELETE slots error:", e?.message || e);
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

    const { error } = await supabaseAdmin.from("slots").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, count: 1 });
  } catch (e: any) {
    console.error("DELETE slot error:", e?.message || e);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
