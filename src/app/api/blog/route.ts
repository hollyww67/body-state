import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("blog_posts")
    .select("slug, title, excerpt, image, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ posts: data || [] });
}
