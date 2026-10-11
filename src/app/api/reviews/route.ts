import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONSENT_VERSION, hasPersonalDataConsent } from "@/lib/legal";
import { cleanMultiline, cleanText, enforceRateLimit, readJsonObject } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("product_id");
    let query = db
      .from("reviews")
      .select("id,author_name,text,rating,created_at,product_id")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;

    if (error) {
      console.error("GET reviews error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(productId ? { reviews: data || [] } : data || []);
  } catch (e: any) {
    console.error("GET reviews exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, "reviews", 3, 60 * 60);
    if (limited) return limited;
    const body = await readJsonObject(request, 16_384);
    const author_name = cleanText(body.author_name, 80);
    const text = cleanMultiline(body.text, 3000);
    const rating = Number(body.rating);

    if (!author_name || !text) {
      return NextResponse.json({ error: "Имя и текст обязательны" }, { status: 400 });
    }
    if (!hasPersonalDataConsent(body.consent) || !hasPersonalDataConsent(body.publication_consent)) return NextResponse.json({ error: "Необходимы отдельные согласия на обработку и публикацию" }, { status: 400 });

    const { data, error } = await db.from("reviews").insert({
      author_name,
      text,
      rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5,
      product_id: typeof body.product_id === "string" && body.product_id ? body.product_id : null,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      publication_consent_version: CONSENT_VERSION,
      publication_consent_at: new Date().toISOString(),
      moderation_status: "pending",
      is_published: false,
      source: "website",
      publication_consent_evidence: "website-form",
    }).select();

    if (error) {
      console.error("POST reviews error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e: any) {
    console.error("POST reviews exception:", e?.message || e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
