import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isShopVisible } from "@/lib/site-visibility";

export async function GET() {
  if (!(await isShopVisible())) return NextResponse.json({ error: "Магазин недоступен" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const { data, error } = await db
    .from("products")
    .select("id, slug, name, description, price, stock, images, category, subcategory, sort_order, popularity")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить товары" }, { status: 500 });
  }

  return NextResponse.json({ products: data || [] });
}
