import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pool } from "@/lib/db";
import { cleanMultiline, readJsonObject } from "@/lib/request";

const statuses = new Set(["new", "reviewing", "resolved", "rejected"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await readJsonObject(request, 8_192);
    const status = typeof body.status === "string" ? body.status : "";
    const resolutionNote = cleanMultiline(body.resolution_note, 1500);
    if (!statuses.has(status)) return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });

    const result = await pool.query(
      `UPDATE review_reports
       SET status = $1, resolution_note = $2, updated_at = now()
       WHERE id = $3
       RETURNING id`,
      [status, resolutionNote || null, id],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH review report error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Ошибка обновления жалобы" }, { status: 500 });
  }
}
