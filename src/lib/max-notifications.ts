import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, pool } from "@/lib/db";
import { type ProviderResult, providerFailure } from "@/lib/notification-result";
import { recordMaxAdminPending } from "@/lib/max-admin-binding";

export const maxEnabled = () => process.env.NOTIFICATIONS_MAX_V1_ENABLED === "true";
export const maxHash = (value: string) => createHash("sha256").update(value).digest("hex");
const CODE = /^[A-Za-z0-9_-]{43}$/;
const id = (v: unknown): string | null => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? String(v) : null;
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function validMaxSecret(actual: string | null): boolean {
  const expected = process.env.MAX_WEBHOOK_SECRET;
  return !!expected && expected.length >= 32 && expected.length <= 256 && !!actual && actual.length <= 256
    && timingSafeEqual(Buffer.from(maxHash(actual), "hex"), Buffer.from(maxHash(expected), "hex"));
}

export async function readMaxUpdate(request: Request | Response): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 65_536) throw new Error("MAX_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("MAX_INVALID");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) { await reader.cancel(); throw new Error("MAX_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function parseMaxUpdate(input: unknown, now = Date.now()) {
  const update = object(input);
  const message = object(update.message);
  const sender = object(message.sender);
  const recipient = object(message.recipient);
  const body = object(message.body);
  const userId = id(sender.user_id);
  const chatId = id(recipient.chat_id);
  if (update.update_type !== "message_created" || !Number.isSafeInteger(update.timestamp)
    || (update.timestamp as number) <= 0 || (update.timestamp as number) > now + 60_000
    || !userId || !chatId || sender.is_bot !== false || recipient.chat_type !== "dialog"
    || typeof body.mid !== "string" || !/^[\w.:-]{1,200}$/.test(body.mid)
    || typeof body.text !== "string" || body.text.length > 4096) throw new Error("MAX_INVALID");
  const text = body.text.trim();
  const candidate = text.startsWith("/start ") ? text.slice(7) : text;
  return { key: maxHash(`message_created:${chatId}:${body.mid}`), userId, chatId,
    timestamp: update.timestamp as number, code: CODE.test(candidate) ? candidate : null };
}

export async function createMaxPairing(accountUserId: string) {
  if (!maxEnabled()) throw new Error("MAX_DISABLED");
  const botUrl = new URL(process.env.MAX_BOT_URL || "");
  if (botUrl.protocol !== "https:" || botUrl.hostname !== "max.ru" || botUrl.port || botUrl.username || botUrl.password
    || !/^\/[A-Za-z0-9_-]+$/.test(botUrl.pathname) || botUrl.search || botUrl.hash) throw new Error("MAX_NOT_CONFIGURED");
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await db.transaction(async client => {
    const account = await client.query("SELECT id FROM account_users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE", [accountUserId]);
    if (!account.rowCount) throw new Error("MAX_ACCOUNT_UNAVAILABLE");
    await client.query(`INSERT INTO max_pairing_codes(account_user_id,code_hash,expires_at) VALUES($1,$2,$3)
      ON CONFLICT(account_user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, created_at=now()`,
    [accountUserId, maxHash(code), expiresAt]);
  });
  return { code, expiresAt, botUrl: botUrl.toString() };
}

export async function unlinkMax(accountUserId: string) {
  if (!maxEnabled()) throw new Error("MAX_DISABLED");
  await db.transaction(async client => {
    await client.query("SELECT id FROM account_users WHERE id=$1 FOR UPDATE", [accountUserId]);
    await client.query("DELETE FROM max_pairing_codes WHERE account_user_id=$1", [accountUserId]);
    await client.query("DELETE FROM max_account_bindings WHERE account_user_id=$1", [accountUserId]);
  });
}

export async function acceptMaxUpdate(update: ReturnType<typeof parseMaxUpdate>) {
  if (!maxEnabled()) throw new Error("MAX_DISABLED");
  return db.transaction(async client => {
    await client.query("SET LOCAL statement_timeout='5s'");
    const inserted = await client.query(`INSERT INTO max_incoming_updates(update_key,update_type)
      VALUES($1,'message_created') ON CONFLICT DO NOTHING RETURNING update_key`, [update.key]);
    if (!inserted.rowCount) return { duplicate: true };
    if (update.code) {
      const hash = maxHash(update.code);
      const owner = await client.query<{ account_user_id: string }>(
        "SELECT account_user_id FROM max_pairing_codes WHERE code_hash=$1 AND expires_at>now()", [hash]);
      if (owner.rows[0]) {
        const accountId = owner.rows[0].account_user_id;
        const account = await client.query("SELECT id FROM account_users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE", [accountId]);
        if (account.rowCount) {
          const consumed = await client.query(`DELETE FROM max_pairing_codes WHERE account_user_id=$1 AND code_hash=$2
            AND expires_at>now() AND created_at<=to_timestamp($3::double precision/1000) RETURNING account_user_id`,
          [accountId, hash, update.timestamp]);
          if (consumed.rowCount) {
            // Unique identity conflicts roll back the entire transaction; never steal another account's identity.
            await client.query(`INSERT INTO max_account_bindings(account_user_id,max_user_id,max_chat_id) VALUES($1,$2,$3)
              ON CONFLICT(account_user_id) DO UPDATE SET max_user_id=EXCLUDED.max_user_id,max_chat_id=EXCLUDED.max_chat_id,created_at=now()`,
            [accountId, update.userId, update.chatId]);
          }
        }
      } else {
        await recordMaxAdminPending(client, update.code, update.userId, update.chatId, update.timestamp);
      }
    }
    await client.query("UPDATE max_incoming_updates SET processed_at=now() WHERE update_key=$1", [update.key]);
    return { duplicate: false };
  });
}

export type MaxRecipient = {role:'client';accountUserId:string;boundAt:string}|{role:'admin';boundAt:string};
export async function deliverMax(to: string, text: string, expected?:MaxRecipient): Promise<ProviderResult> {
  if (!maxEnabled() || !process.env.MAX_BOT_TOKEN) return { status: "not_configured", error: "channel_not_configured" };
  if (!/^[1-9][0-9]{0,18}$/.test(to) || !text.trim() || text.length > 4000) return { status: "failed", error: "provider_rejected" };
  if(!expected||!Number.isFinite(Date.parse(expected.boundAt)))return {status:'failed',error:'contact_missing'};
  // Dispatch only to a currently linked private dialog. Queue must resolve the current binding before each send.
  try {
    const binding = expected.role==='admin'
      ?await pool.query('SELECT max_chat_id FROM max_admin_binding WHERE singleton=true AND max_chat_id=$1 AND confirmed_at=$2',[to,expected.boundAt])
      :await pool.query(`SELECT b.max_chat_id FROM max_account_bindings b JOIN account_users a ON a.id=b.account_user_id
        WHERE b.max_chat_id=$1 AND b.account_user_id=$2 AND b.created_at=$3 AND a.disabled_at IS NULL`,[to,expected.accountUserId,expected.boundAt]);
    if (!binding.rowCount) return { status: "failed", error: "contact_missing" };
  } catch { return { status: "retry", error: "provider_unavailable" }; }
  try {
    const response = await fetch(`https://platform-api2.max.ru/messages?chat_id=${encodeURIComponent(to)}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: process.env.MAX_BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ text, notify: true }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      // A server failure may occur after acceptance: manual review avoids an automatic duplicate.
      return response.status >= 500 ? { status: "uncertain", error: "provider_outcome_unknown" } : providerFailure(response.status);
    }
    const result = object(await readMaxUpdate(response));
    const mid = object(object(result.message).body).mid;
    return typeof mid === "string" && /^[\w.:-]{1,200}$/.test(mid)
      ? { status: "accepted", id: mid } : { status: "uncertain", error: "provider_outcome_unknown" };
  } catch { return { status: "uncertain", error: "provider_outcome_unknown" }; }
}
