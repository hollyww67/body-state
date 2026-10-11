import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanText, enforceRateLimit, readJsonObject } from "@/lib/request";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "chat", 30, 10 * 60);
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 4096); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const message = cleanText(body.message, 1000);

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Сообщение обязательно" }, { status: 400 });
  }

  const words = message.toLowerCase().split(/\s+/);

  const { data, error } = await db
    .from("faq_answers")
    .select("*")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ reply: "Извините, произошла ошибка. Попробуйте позже." });
  }

  let bestMatch: any = null;
  let bestScore = 0;

  for (const faq of data || []) {
    let score = 0;
    for (const word of words) {
      if (faq.keywords?.some((kw: string) => kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase()))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && bestScore > 0) {
    return NextResponse.json({ reply: bestMatch.answer });
  }

  return NextResponse.json({
    reply: "Я пока не знаю ответа на этот вопрос. Свяжитесь со специалистом через раздел «Контакты» или оставьте заявку на странице записи.",
  });
}
