import { NextResponse } from "next/server";

/** Legacy checkout accepted client-controlled totals. All purchases use /api/payment/init. */
export async function POST() {
  return NextResponse.json({ error: "Используйте защищённую форму оплаты" }, { status: 410 });
}
