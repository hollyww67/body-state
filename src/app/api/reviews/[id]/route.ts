import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { cleanMultiline, cleanText, readJsonObject } from "@/lib/request";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    const body = await readJsonObject(request, 16_384);
    const updates: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if ("author_name" in body) {
      const value = cleanText(body.author_name, 80);
      if (!value) return NextResponse.json({ error: "Имя не может быть пустым" }, { status: 400 });
      set("author_name", value);
    }
    if ("text" in body) {
      const value = cleanMultiline(body.text, 3000);
      if (!value) return NextResponse.json({ error: "Текст не может быть пустым" }, { status: 400 });
      set("text", value);
    }
    if ("rating" in body) {
      const value = Number(body.rating);
      if (!Number.isInteger(value) || value < 1 || value > 5) return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
      set("rating", value);
    }
    if ("moderation_note" in body) set("moderation_note", cleanMultiline(body.moderation_note, 1500) || null);
    if ("publication_consent_evidence" in body) set("publication_consent_evidence", cleanText(body.publication_consent_evidence, 300) || null);

    if ("is_published" in body || "moderation_status" in body) {
      const publish = body.is_published === true || body.moderation_status === "published";
      if (publish) {
        const evidence = await pool.query(
          "SELECT publication_consent_at, publication_consent_evidence FROM reviews WHERE id = $1",
          [id],
        );
        const row = evidence.rows[0];
        const suppliedEvidence = cleanText(body.publication_consent_evidence, 300);
        if (!row || (!row.publication_consent_at && !row.publication_consent_evidence && !suppliedEvidence)) {
          return NextResponse.json({ error: "Нельзя публиковать без подтверждения согласия автора" }, { status: 400 });
        }
        set("is_published", true);
        set("moderation_status", "published");
        set("moderated_at", new Date().toISOString());
      } else {
        set("is_published", false);
        set("moderation_status", body.moderation_status === "rejected" ? "rejected" : "pending");
        set("moderated_at", new Date().toISOString());
      }
    }

    if (!updates.length) return NextResponse.json({ error: "Нет допустимых изменений" }, { status: 400 });
    set("updated_at", new Date().toISOString());
    values.push(id);
    const result = await pool.query(
      `UPDATE reviews SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (!result.rowCount) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("PATCH review exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка обновления" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await params;
    const { error } = await db
      .from("reviews")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE review error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("DELETE review exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
