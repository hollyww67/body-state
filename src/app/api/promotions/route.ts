import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await pool.query(
    `SELECT id::text, title, summary, details, badge, cta_label, cta_url
     FROM promotions
     WHERE is_active = true
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at >= now())
     ORDER BY created_at DESC
     LIMIT 3`,
  );

  return NextResponse.json(
    { promotions: result.rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
