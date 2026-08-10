import { supabaseAdmin } from "./supabase";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@yourdomain.ru";

export async function sendTelegramToClient(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("Telegram client send error:", e);
  }
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!EMAIL_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Пространство <${EMAIL_FROM}>`,
        to,
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("Email send error:", e);
  }
}
