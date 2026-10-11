import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONSENT_VERSION, hasPersonalDataConsent } from "@/lib/legal";
import { cleanMultiline, enforceRateLimit, normalizeEmail, readJsonObject } from "@/lib/request";

const allowedReasons = new Set([
  "personal_data",
  "false_information",
  "offensive",
  "prohibited_content",
  "rights_violation",
  "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = await enforceRateLimit(request, "review-report", 5, 24 * 60 * 60);
    if (limited) return limited;

    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });

    const body = await readJsonObject(request, 8_192);
    const reason = typeof body.reason === "string" ? body.reason : "";
    const details = cleanMultiline(body.details, 1500);
    const reporterEmailRaw = typeof body.reporter_email === "string" ? body.reporter_email.trim() : "";
    const reporter_email = reporterEmailRaw ? normalizeEmail(reporterEmailRaw) : "";

    if (!allowedReasons.has(reason)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    if (reporterEmailRaw && !reporter_email) {
      return NextResponse.json({ error: "Проверьте адрес электронной почты" }, { status: 400 });
    }
    if (reporter_email && !hasPersonalDataConsent(body.consent)) {
      return NextResponse.json({ error: "Для обратной связи необходимо согласие на обработку e-mail" }, { status: 400 });
    }

    const { data: review, error: reviewError } = await db
      .from("reviews")
      .select("id")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (reviewError || !review) return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });

    const now = new Date().toISOString();
    const { error } = await db.from("review_reports").insert({
      review_id: Number(id),
      reason,
      details: details || null,
      reporter_email: reporter_email || null,
      consent_version: reporter_email ? CONSENT_VERSION : null,
      consent_at: reporter_email ? now : null,
      status: "new",
      updated_at: now,
    });

    if (error) {
      console.error("POST review report error:", error.message);
      return NextResponse.json({ error: "Не удалось отправить жалобу" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST review report exception:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Не удалось отправить жалобу" }, { status: 500 });
  }
}
