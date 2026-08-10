import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET reviews error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (e: any) {
    console.error("GET reviews exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author_name, text, rating } = body;

    if (!author_name || !text) {
      return NextResponse.json({ error: "Имя и текст обязательны" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("reviews").insert({
      author_name,
      text,
      rating: rating || 5,
    }).select();

    if (error) {
      console.error("POST reviews error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e: any) {
    console.error("POST reviews exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
