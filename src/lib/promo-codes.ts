import { randomInt } from "crypto";
import { pool } from "@/lib/db";

export const PROMO_SERVICE_CODES = ["bfm", "brt", "psychology", "psychology_program"] as const;
export type PromoServiceCode = typeof PROMO_SERVICE_CODES[number];
export type PromoDiscountType = "percent" | "fixed";

export type PromoCodeRecord = {
  id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  service_codes: string[];
  max_redemptions: number | null;
  redeemed_count: number;
  reserved_count: number;
  expires_at: string | null;
  is_active: boolean;
  assigned_account_user_id?: string | null;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizePromoCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 32);
}

export function generatePromoCode(prefix = "BODY") {
  let suffix = "";
  for (let index = 0; index < 8; index++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${normalizePromoCode(prefix).replace(/[^A-Z0-9]/g, "").slice(0, 8) || "BODY"}-${suffix}`;
}

export function calculatePromoDiscount(subtotal: number, type: PromoDiscountType, value: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(value) || value <= 0) return 0;
  const raw = type === "percent" ? subtotal * value / 100 : value;
  return Math.round(raw * 100) / 100;
}

export async function validatePromoCode(codeValue: unknown, serviceCode: PromoServiceCode, subtotal: number, accountUserId?: string | null) {
  const code = normalizePromoCode(codeValue);
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) throw new Error("Введите корректный промокод");
  const result = await pool.query<PromoCodeRecord>(
    `SELECT id, code, discount_type, discount_value, service_codes, max_redemptions,
            redeemed_count, reserved_count, expires_at, is_active, assigned_account_user_id
       FROM promo_codes WHERE code=$1 LIMIT 1`,
    [code],
  );
  const promo = result.rows[0];
  if (!promo || !promo.is_active) throw new Error("Промокод не найден или отключён");
  if (promo.assigned_account_user_id && promo.assigned_account_user_id !== accountUserId) throw new Error("Этот промокод доступен только в личном кабинете владельца");
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) throw new Error("Срок действия промокода истёк");
  if (!promo.service_codes.includes(serviceCode)) throw new Error("Промокод не действует на эту процедуру");
  if (promo.max_redemptions !== null && promo.redeemed_count + promo.reserved_count >= promo.max_redemptions) throw new Error("Лимит применений промокода исчерпан");
  const discount = calculatePromoDiscount(subtotal, promo.discount_type, Number(promo.discount_value));
  if (discount <= 0 || discount >= subtotal) throw new Error("Промокод нельзя применить к этой стоимости");
  return { promo, discount, total: Math.round((subtotal - discount) * 100) / 100 };
}
