import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Сообщение обязательно" }, { status: 400 });
  }

  const words = message.toLowerCase().split(/\s+/);

  const { data, error } = await supabaseAdmin
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
    reply: "Я пока не знаю ответа на этот вопрос. Оставьте свой номер — специалист свяжется с вами и всё расскажет.",
    askPhone: true,
  });
}
