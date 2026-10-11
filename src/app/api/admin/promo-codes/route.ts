import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pool } from "@/lib/db";
import { cleanText, readJsonObject } from "@/lib/request";
import { generatePromoCode, normalizePromoCode, PROMO_SERVICE_CODES, type PromoDiscountType } from "@/lib/promo-codes";

const SELECT_FIELDS = `id, code, discount_type, discount_value, service_codes, max_redemptions,
  redeemed_count, reserved_count, expires_at, is_active, assigned_account_user_id, source, created_at, updated_at`;

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const result = await pool.query(`SELECT ${SELECT_FIELDS} FROM promo_codes ORDER BY created_at DESC`);
  return NextResponse.json({ promoCodes: result.rows });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJsonObject(request, 16_384);
    const discountType: PromoDiscountType = body.discountType === "fixed" ? "fixed" : "percent";
    const discountValue = Number(body.discountValue);
    const maxRedemptions = body.maxRedemptions === null || body.maxRedemptions === "" || body.maxRedemptions === undefined ? null : Number(body.maxRedemptions);
    const expiresAtRaw = cleanText(body.expiresAt, 64);
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const serviceCodes = Array.isArray(body.serviceCodes)
      ? body.serviceCodes.map((value) => String(value)).filter((value) => (PROMO_SERVICE_CODES as readonly string[]).includes(value))
      : [];
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === "percent" && discountValue >= 100)) {
      return NextResponse.json({ error: "Укажите корректную скидку меньше 100%" }, { status: 400 });
    }
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) return NextResponse.json({ error: "Лимит должен быть целым положительным числом" }, { status: 400 });
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) return NextResponse.json({ error: "Срок действия должен быть в будущем" }, { status: 400 });
    if (!serviceCodes.length) return NextResponse.json({ error: "Выберите хотя бы одну процедуру" }, { status: 400 });

    const requestedCode = normalizePromoCode(body.code);
    if (requestedCode && !/^[A-Z0-9-]{4,32}$/.test(requestedCode)) return NextResponse.json({ error: "Код: 4–32 символа, латинские буквы, цифры или дефис" }, { status: 400 });

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = requestedCode || generatePromoCode();
      try {
        const result = await pool.query(
          `INSERT INTO promo_codes (code, discount_type, discount_value, service_codes, max_redemptions, expires_at)
           VALUES ($1,$2,$3,$4::text[],$5,$6) RETURNING ${SELECT_FIELDS}`,
          [code, discountType, discountValue, serviceCodes, maxRedemptions, expiresAt?.toISOString() || null],
        );
        return NextResponse.json({ promoCode: result.rows[0] }, { status: 201 });
      } catch (error) {
        if ((error as { code?: string }).code !== "23505" || requestedCode) throw error;
      }
    }
    return NextResponse.json({ error: "Не удалось подобрать уникальный код" }, { status: 500 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Такой промокод уже существует" }, { status: 409 });
    console.error("[Promo admin] create failed", error);
    return NextResponse.json({ error: "Не удалось создать промокод" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJsonObject(request, 8_192);
    const id = cleanText(body.id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.isActive !== "boolean") return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    const result = await pool.query(
      `UPDATE promo_codes SET is_active=$2, updated_at=now() WHERE id=$1 RETURNING ${SELECT_FIELDS}`,
      [id, body.isActive],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
    return NextResponse.json({ promoCode: result.rows[0] });
  } catch (error) {
    console.error("[Promo admin] update failed", error);
    return NextResponse.json({ error: "Не удалось обновить промокод" }, { status: 500 });
  }
}
