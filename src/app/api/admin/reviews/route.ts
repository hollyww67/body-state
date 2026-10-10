import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { pool } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/legal";
import { cleanMultiline, cleanText, readJsonObject } from "@/lib/request";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const [reviews, reports] = await Promise.all([
      pool.query(`
        SELECT r.id, r.author_name, r.text, r.rating, r.created_at, r.is_published,
               r.moderation_status, r.moderation_note, r.source,
               r.publication_consent_at, r.publication_consent_evidence,
               count(rr.id) FILTER (WHERE rr.status IN ('new', 'reviewing'))::int AS open_reports
        FROM reviews r
        LEFT JOIN review_reports rr ON rr.review_id = r.id
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `),
      pool.query(`
        SELECT rr.id, rr.review_id, rr.reason, rr.details, rr.reporter_email,
               rr.status, rr.resolution_note, rr.created_at,
               r.author_name AS review_author, r.text AS review_text
        FROM review_reports rr
        JOIN reviews r ON r.id = rr.review_id
        ORDER BY CASE rr.status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                 rr.created_at DESC
        LIMIT 200
      `),
    ]);
    return NextResponse.json({ reviews: reviews.rows, reports: reports.rows });
  } catch (error) {
    console.error("GET admin reviews error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Ошибка загрузки отзывов" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonObject(request, 16_384);
    const authorName = cleanText(body.author_name, 80);
    const text = cleanMultiline(body.text, 3000);
    const evidence = cleanText(body.publication_consent_evidence, 300);
    const rating = Number(body.rating);
    if (!authorName || !text || !evidence) {
      return NextResponse.json({ error: "Нужны имя, текст и ссылка на подтверждение согласия автора" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO reviews (
        author_name, text, rating, consent_version, consent_at,
        publication_consent_version, publication_consent_at,
        publication_consent_evidence, moderation_status, is_published,
        moderated_at, source, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $4, $5, $6, 'published', true, $5, 'admin', $5)
      RETURNING id`,
      [authorName, text, Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5, CONSENT_VERSION, now, evidence],
    );
    return NextResponse.json({ success: true, id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("POST admin review error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Ошибка добавления отзыва" }, { status: 500 });
  }
}
