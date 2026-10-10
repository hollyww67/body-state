import { pool } from "@/lib/db";

export type ServicePrice = {
  code: string;
  label: string;
  price: number;
  prefix: string;
  is_active: boolean;
};

const FALLBACK_PRICES: Record<string, ServicePrice> = {
  bfm: { code: "bfm", label: "Физическая реабилитация", price: 3000, prefix: "", is_active: true },
  brt: { code: "brt", label: "Биорезонансная терапия", price: 3000, prefix: "", is_active: true },
  psychology: { code: "psychology", label: "Психологическая реабилитация", price: 3000, prefix: "", is_active: true },
  "recovery-program": { code: "recovery-program", label: "Комплексная программа восстановления", price: 25000, prefix: "от", is_active: true },
};

export async function getServicePrice(code: string): Promise<ServicePrice> {
  try {
    const result = await pool.query<ServicePrice>(
      `SELECT code, label, price, prefix, is_active FROM service_prices WHERE code=$1 LIMIT 1`,
      [code],
    );
    return result.rows[0] || FALLBACK_PRICES[code] || { code, label: code, price: 0, prefix: "", is_active: true };
  } catch {
    return FALLBACK_PRICES[code] || { code, label: code, price: 0, prefix: "", is_active: true };
  }
}

export function formatServicePrice(price: number, prefix = "от") {
  return `${prefix ? `${prefix} ` : ""}${Number(price).toLocaleString("ru-RU")} ₽`;
}
