import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pool } from "@/lib/db";
import { cleanText, readJsonObject } from "@/lib/request";

const FIELDS = "id::text, visits_required, discount_percent, is_active, created_at, updated_at";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request); if (unauthorized) return unauthorized;
  const result = await pool.query(`SELECT ${FIELDS} FROM loyalty_rules ORDER BY visits_required`);
  return NextResponse.json({ rules: result.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request); if (unauthorized) return unauthorized;
  try {
    const body = await readJsonObject(request, 8_192);
    const visits = Number(body.visitsRequired); const discount = Number(body.discountPercent);
    if (!Number.isInteger(visits) || visits < 1 || visits > 10000 || !Number.isFinite(discount) || discount <= 0 || discount >= 100) return NextResponse.json({ error: "Проверьте количество приёмов и процент" }, { status: 400 });
    const result = await pool.query(`INSERT INTO loyalty_rules (visits_required,discount_percent) VALUES ($1,$2) RETURNING ${FIELDS}`, [visits, discount]);
    return NextResponse.json({ rule: result.rows[0] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Для этого количества приёмов правило уже существует" }, { status: 409 });
    console.error("[Loyalty admin] create failed", error); return NextResponse.json({ error: "Не удалось создать правило" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin(request); if (unauthorized) return unauthorized;
  try {
    const body = await readJsonObject(request, 8_192); const id = cleanText(body.id, 64);
    const visits = Number(body.visitsRequired); const discount = Number(body.discountPercent);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(visits) || visits < 1 || !Number.isFinite(discount) || discount <= 0 || discount >= 100 || typeof body.isActive !== "boolean") return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    const result = await pool.query(`UPDATE loyalty_rules SET visits_required=$2,discount_percent=$3,is_active=$4,updated_at=now() WHERE id=$1 RETURNING ${FIELDS}`, [id, visits, discount, body.isActive]);
    if (!result.rows[0]) return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });
    return NextResponse.json({ rule: result.rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Такой рубеж уже существует" }, { status: 409 });
    return NextResponse.json({ error: "Не удалось сохранить правило" }, { status: 500 });
  }
}
