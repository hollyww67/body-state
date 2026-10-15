import crypto from "crypto";
import type { PoolClient } from "pg";
import { enqueueAccountNotification } from "@/lib/notification-core";

export function resetNotificationsEnabled() {
  return process.env.NOTIFICATIONS_EMAIL_V1_ENABLED === "true";
}

export function assertResetKeyConfigured() {
  const key = process.env.NOTIFICATION_RESET_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) throw new Error("RESET_KEY_NOT_CONFIGURED");
  return key;
}

// Server-only primitive. Keep this key stable while queued reset tokens are alive.
// Neither this token nor the key may be persisted in notification payloads/logs.
export function deriveResetToken(resetId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resetId)) {
    throw new Error("INVALID_RESET_ID");
  }
  return crypto.createHmac("sha256", assertResetKeyConfigured()).update(resetId).digest("base64url");
}

// Public worker contract; derives only in memory after checking token validity.
export const createNotificationResetToken = deriveResetToken;

export function resetTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function enqueuePasswordReset(client: PoolClient, identity: string) {
  // All reset issuance/consumption locks the account before any token row.
  const found = await client.query<{ id: string; email: string | null }>(
    `SELECT id::text, email FROM account_users
     WHERE disabled_at IS NULL AND (lower(username)=$1 OR lower(email)=$1)
     LIMIT 1 FOR UPDATE`, [identity],
  );
  const account = found.rows[0];
  if (!account?.email) return;
  const resetId = crypto.randomUUID();
  const tokenHash = resetTokenHash(deriveResetToken(resetId));
  await client.query("UPDATE account_password_reset_tokens SET used_at=now() WHERE account_user_id=$1 AND used_at IS NULL", [account.id]);
  await client.query(
    `INSERT INTO account_password_reset_tokens (id, account_user_id, token_hash, expires_at)
     VALUES ($1,$2,$3,now() + interval '30 minutes')`, [resetId, account.id, tokenHash],
  );
  await enqueueAccountNotification(client, account.id, "reset_requested", `reset_requested:${resetId}`, { resetId });
}
