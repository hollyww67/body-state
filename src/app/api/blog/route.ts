import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { data } = await db
    .from("blog_posts")
    .select("slug, title, excerpt, image, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({ posts: data || [] });
}
