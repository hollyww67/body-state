import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanMultiline, cleanText, readJsonObject } from "@/lib/request";

function productPayload(body: Record<string, unknown>) {
  const name = cleanText(body.name, 160);
  const slug = cleanText(body.slug, 120).toLowerCase();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const volume = body.volume_ml === null || body.volume_ml === "" ? null : Number(body.volume_ml);
  const sortOrder = body.sort_order === null || body.sort_order === "" ? 0 : Number(body.sort_order);
  const images = Array.isArray(body.images)
    ? body.images.map((value) => cleanText(value, 500)).filter((value) => /^\/(?:uploads|media)\//.test(value)).slice(0, 12)
    : [];

  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Укажите название и корректный slug");
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new Error("Проверьте цену");
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new Error("Проверьте остаток");
  if (volume !== null && (!Number.isInteger(volume) || volume <= 0 || volume > 100_000)) throw new Error("Проверьте объём");
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 1_000_000) throw new Error("Проверьте порядок");

  return {
    name,
    slug,
    description: cleanMultiline(body.description, 5_000) || null,
    composition: cleanMultiline(body.composition, 5_000) || null,
    price,
    stock,
    volume_ml: volume,
    images,
    category: cleanText(body.category, 60) || "care",
    subcategory: cleanText(body.subcategory, 120) || null,
    sort_order: sortOrder,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const { data, error } = await db.from("products").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Не удалось загрузить товары" }, { status: 500 });
  return NextResponse.json({ products: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, 64_000);
    const { error } = await db.from("products").insert(productPayload(body));
    if (error) {
      const conflict = (error as { code?: string }).code === "23505";
      return NextResponse.json({ error: conflict ? "Товар с таким slug уже существует" : "Не удалось создать товар" }, { status: conflict ? 409 : 500 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный запрос" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Некорректный товар" }, { status: 400 });
  try {
    const body = await readJsonObject(request, 64_000);
    const { data, error } = await db.from("products").update(productPayload(body)).eq("id", id).select("id").maybeSingle();
    if (error) {
      const conflict = (error as { code?: string }).code === "23505";
      return NextResponse.json({ error: conflict ? "Товар с таким slug уже существует" : "Не удалось сохранить товар" }, { status: conflict ? 409 : 500 });
    }
    if (!data) return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректный запрос" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Некорректный товар" }, { status: 400 });
  const { data, error } = await db.from("products").delete().eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Не удалось удалить товар" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
