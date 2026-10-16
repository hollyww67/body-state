import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { db, pool } from "@/lib/db";
import { maxEnabled } from '@/lib/max-rollout';

const hash = (code: string) => createHash("sha256").update(code).digest("hex");
function enabled() { if (!maxEnabled()) throw new Error("MAX_DISABLED"); }
// Every admin mutation takes this same lock, including when the singleton row does not exist yet.
async function lock(client: PoolClient) { await client.query("SELECT pg_advisory_xact_lock(221022,1)"); }

export async function createMaxAdminPairing() {
  enabled();
  const bot = new URL(process.env.MAX_BOT_URL || "");
  if (bot.protocol !== "https:" || bot.hostname !== "max.ru" || bot.port || bot.username || bot.password
    || !/^\/[A-Za-z0-9_-]+$/.test(bot.pathname) || bot.search || bot.hash) throw new Error("MAX_NOT_CONFIGURED");
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 300_000).toISOString();
  await db.transaction(async client => {
    await lock(client);
    await client.query(`INSERT INTO max_admin_pairing(singleton,code_hash,expires_at) VALUES(true,$1,$2)
      ON CONFLICT(singleton) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,
      pending_user_id=NULL,pending_chat_id=NULL,created_at=now()`, [hash(code), expiresAt]);
  });
  return { code, expiresAt, botUrl: bot.toString() };
}

// Called inside the webhook's inbox transaction, after client pairing has been checked.
export async function recordMaxAdminPending(client: PoolClient, code: string, userId: string, chatId: string, timestamp: number) {
  enabled();
  await lock(client);
  await client.query(`UPDATE max_admin_pairing SET pending_user_id=$2,pending_chat_id=$3
    WHERE singleton=true AND code_hash=$1 AND expires_at>now() AND pending_user_id IS NULL
    AND created_at<=to_timestamp($4::double precision/1000)`, [hash(code), userId, chatId, timestamp]);
}

export async function getMaxAdminBinding() {
  enabled();
  const result = await pool.query(`SELECT
    EXISTS(SELECT 1 FROM max_admin_binding WHERE singleton=true) AS connected,
    (SELECT row_to_json(p) FROM (SELECT pending_user_id AS "maxUserId", pending_chat_id AS "maxChatId", expires_at AS "expiresAt"
      FROM max_admin_pairing WHERE singleton=true AND expires_at>now() AND pending_user_id IS NOT NULL) p) AS pending`);
  return result.rows[0] || { connected: false, pending: null };
}

export async function confirmMaxAdminBinding(userId: unknown, chatId: unknown) {
  enabled();
  if (typeof userId !== "string" || typeof chatId !== "string" || !/^[1-9][0-9]{0,18}$/.test(userId)
    || !/^[1-9][0-9]{0,18}$/.test(chatId)) return false;
  return db.transaction(async client => {
    await lock(client);
    const pending = await client.query(`DELETE FROM max_admin_pairing WHERE singleton=true AND expires_at>now()
      AND pending_user_id=$1 AND pending_chat_id=$2 RETURNING singleton`, [userId, chatId]);
    if (!pending.rowCount) return false;
    await client.query(`INSERT INTO max_admin_binding(singleton,max_user_id,max_chat_id) VALUES(true,$1,$2)
      ON CONFLICT(singleton) DO UPDATE SET max_user_id=EXCLUDED.max_user_id,max_chat_id=EXCLUDED.max_chat_id,confirmed_at=now()`, [userId, chatId]);
    return true;
  });
}

export async function revokeMaxAdminBinding() {
  enabled();
  await db.transaction(async client => {
    await lock(client);
    await client.query("DELETE FROM max_admin_pairing WHERE singleton=true");
    await client.query("DELETE FROM max_admin_binding WHERE singleton=true");
  });
}
