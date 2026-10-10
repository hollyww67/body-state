import nodemailer, { type Transporter } from "nodemailer";
import { providerFailure, type ProviderResult } from '@/lib/notification-result';

const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@yourdomain.ru";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Пространство";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;

let smtpTransport: Transporter | undefined;

function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD && EMAIL_FROM);
}

function isResendConfigured() {
  return Boolean(EMAIL_API_KEY && EMAIL_FROM && !EMAIL_FROM.endsWith("@yourdomain.ru"));
}

export function isEmailConfigured() {
  return isSmtpConfigured() || isResendConfigured();
}

function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      requireTLS: !SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return smtpTransport;
}

export async function deliverEmail(to: string, subject: string, html: string): Promise<ProviderResult> {
  if (!isEmailConfigured()) return {status:'not_configured',error:'channel_not_configured'};

  try {
    if (isSmtpConfigured()) {
      const info = await getSmtpTransport().sendMail({
        from: { name: EMAIL_FROM_NAME, address: EMAIL_FROM },
        replyTo: EMAIL_REPLY_TO,
        to,
        subject,
        html,
      });
      return {status:'accepted',id:info.messageId};
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        reply_to: EMAIL_REPLY_TO,
        to,
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return providerFailure(response.status);
    const data=await response.json().catch(()=>({}));
    return {status:'accepted',id:typeof data.id==='string'?data.id:undefined};
  } catch {
    return {status:'uncertain',error:'provider_outcome_unknown'};
  }
}
export async function sendEmail(to:string, subject:string, html:string):Promise<boolean> {
  const r=await deliverEmail(to,subject,html); return r.status==='accepted'||r.status==='delivered';
}
