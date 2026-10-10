import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanText, enforceRateLimit, readJsonObject } from "@/lib/request";
import { getServicePrice } from "@/lib/service-prices";
import { PROMO_SERVICE_CODES, type PromoServiceCode, validatePromoCode } from "@/lib/promo-codes";
import { getAccountSession } from "@/lib/account-auth";

async function resolveSubtotal(serviceCode: PromoServiceCode, programId: number) {
  if (serviceCode === "psychology_program") {
    if (!Number.isInteger(programId) || programId <= 0) throw new Error("Программа не найдена");
    const { data } = await db.from("psychology_programs").select("price").eq("id", programId).eq("is_active", true).maybeSingle();
    const price = Number(data?.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Программа не найдена");
    return price;
  }
  const service = await getServicePrice(serviceCode);
  if (!service.is_active || service.price <= 0) throw new Error("Стоимость процедуры не настроена");
  return service.price;
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "promo-validate", 30, 60 * 60);
  if (limited) return limited;
  try {
    const body = await readJsonObject(request, 8_192);
    const code = cleanText(body.code, 32);
    const serviceCode = cleanText(body.serviceCode, 32) as PromoServiceCode;
    if (!PROMO_SERVICE_CODES.includes(serviceCode)) return NextResponse.json({ error: "Неизвестная процедура" }, { status: 400 });
    const subtotal = await resolveSubtotal(serviceCode, Number(body.programId));
    const session = await getAccountSession(request);
    const result = await validatePromoCode(code, serviceCode, subtotal, session?.userId);
    return NextResponse.json({ ok: true, code: result.promo.code, subtotal, discount: result.discount, total: result.total });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Промокод не применён" }, { status: 400 });
  }
}
