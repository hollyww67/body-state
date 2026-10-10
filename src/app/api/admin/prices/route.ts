import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { cleanText, readJsonObject } from "@/lib/request";

export async function GET() {
  const [services, psychology, products] = await Promise.all([
    pool.query(`SELECT code, label, price, prefix, is_active, updated_at FROM service_prices ORDER BY label`),
    pool.query(`SELECT id::text, title AS label, price, is_active, updated_at FROM psychology_programs ORDER BY sort_order, title`),
    pool.query(`SELECT id::text, name AS label, price, stock, updated_at FROM products ORDER BY sort_order, name`),
  ]);
  return NextResponse.json({ services: services.rows, psychology: psychology.rows, products: products.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 16_384); }
  catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const kind = cleanText(body.kind, 20);
  const id = cleanText(body.id, 80);
  const price = Number(body.price);
  if (!id || !["service", "psychology", "product"].includes(kind) || !Number.isFinite(price) || price < 0 || price > 10_000_000) {
    return NextResponse.json({ error: "Проверьте цену" }, { status: 400 });
  }

  const table = kind === "service" ? "service_prices" : kind === "psychology" ? "psychology_programs" : "products";
  const column = kind === "service" ? "code" : "id";
  const result = await pool.query(`UPDATE ${table} SET price=$1, updated_at=now() WHERE ${column}::text=$2 RETURNING price`, [price, id]);
  if (!result.rowCount) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });
  return NextResponse.json({ ok: true, price: Number(result.rows[0].price) });
}
