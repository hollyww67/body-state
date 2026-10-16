import nodemailer, { type Transporter } from "nodemailer";
import { providerFailure } from '@/lib/notification-result';
import { reserveSmtpBudget, type SmtpBudgetResult } from '@/lib/notification-smtp-budget';

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

export async function deliverEmail(to: string, subject: string, html: string): Promise<SmtpBudgetResult> {
  if (!isEmailConfigured()) return {status:'not_configured',error:'channel_not_configured'};

  try {
    if (isSmtpConfigured()) {
      // Quotas count recipients. Under the aggregate contract only one mailbox
      // is allowed per call; V1 OFF preserves historical address-list behavior.
      if (process.env.NOTIFICATIONS_EMAIL_V1_ENABLED === 'true' &&
          !/^(?:[^<>\r\n,;]+<)?[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+>?$/.test(to)) {
        return { status: 'failed', error: 'provider_rejected' };
      }
      const budget = await reserveSmtpBudget('legacy');
      if (budget) return budget;
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

export type TransactionalEmail = { to: string; subject: string; html: string; text: string };

// Release A is deliberately independent of legacy delivery and its Resend fallback.
// Read the flag at dispatch time so disabling it also stops an existing worker.
export async function deliverTransactionalEmail(to: string, subject: string, html: string, text: string, dispatch?: { deadlineAt: number }): Promise<SmtpBudgetResult> {
  if (process.env.NOTIFICATIONS_EMAIL_V1_ENABLED !== 'true') {
    return { status: 'not_configured', error: 'channel_not_configured' };
  }
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  const replyTo = process.env.SMTP_REPLY_TO;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const message: TransactionalEmail = { to, subject, html, text };
  const headerSafe = (value: string) => !/[\r\n\0]/.test(value);
  const mailbox = (value: string) => headerSafe(value) &&
    /^(?:[^<>]+<)?[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+>?$/.test(value) &&
    (value.includes('<') === value.endsWith('>'));
  if (!host || !headerSafe(host) || !user || !pass || !from || !mailbox(from) ||
      (replyTo !== undefined && !mailbox(replyTo)) ||
      (process.env.SMTP_PORT || '587') !== '587' ||
      ![undefined, 'false'].includes(process.env.SMTP_SECURE)) {
    return { status: 'not_configured', error: 'channel_not_configured' };
  }
  if (!message || typeof message.to !== 'string' || !mailbox(message.to) ||
      message.to.includes('<') || typeof message.subject !== 'string' ||
      !message.subject.trim() || !headerSafe(message.subject) ||
      typeof message.html !== 'string' || !message.html.trim() ||
      typeof message.text !== 'string' || !message.text.trim()) {
    return { status: 'failed', error: 'provider_rejected' };
  }
  try {
    const budget = await reserveSmtpBudget('v1');
    if (budget) return budget;
    // A late SQL reservation remains spent; it must not start SMTP after the
    // caller's deadline. This is checked again after quota admission, not before.
    if (dispatch && (!Number.isFinite(dispatch.deadlineAt) || Date.now() >= dispatch.deadlineAt)) {
      return { status: 'retry', error: 'smtp_budget_unavailable' };
    }
    const transport = nodemailer.createTransport({
      host, port: 587, secure: false, requireTLS: true,
      ignoreTLS: false, opportunisticTLS: false,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: host },
      auth: { user, pass },
      connectionTimeout: 10_000, greetingTimeout: 10_000,
      socketTimeout: 15_000, dnsTimeout: 10_000,
      logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const info = await transport.sendMail({
      from, replyTo, to: message.to, subject: message.subject,
      html: message.html, text: message.text,
    });
    if (!Array.isArray(info.accepted) || info.accepted.length !== 1) {
      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        return { status: 'failed', error: 'provider_rejected' };
      }
      return { status: 'uncertain', error: 'provider_outcome_unknown' };
    }
    return { status: 'accepted', id: typeof info.messageId === 'string' ? info.messageId : undefined };
  } catch (error: unknown) {
    // Never return/log response text: it can contain credentials, recipient or reset URL.
    const failure = error as { responseCode?: unknown; code?: unknown } | null;
    const status = failure?.responseCode;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return { status: status < 500 ? 'retry' : 'failed',
        error: status < 500 ? 'provider_unavailable' : 'provider_rejected' };
    }
    if (failure?.code === 'EAUTH' || failure?.code === 'ETLS') {
      return { status: 'failed', error: 'provider_rejected' };
    }
    return { status: 'uncertain', error: 'provider_outcome_unknown' };
  }
}
