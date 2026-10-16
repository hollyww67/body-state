import { randomUUID } from 'node:crypto';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';
import type { ProviderResult } from '@/lib/notification-result';

// Owner gate: confirm actual tenant quotas, previous 24h usage, and external
// senders before activation. All SMTP workers must share DATABASE_URL, a stable
// SMTP_BUDGET_SCOPE and identical policy. No default quotas; no Redis dependency.
// ENV: SMTP_BUDGET_QUOTAS_CONFIRMED=true, SMTP_BUDGET_SCOPE,
// SMTP_BUDGET_PER_SECOND / PER_DAY (1..10000000),
// SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND / PER_DAY (0 <= reserve < limit).
// Never change scope or delete live reservations to reset usage. Policy changes
// need a coordinated rollout updating the scope row, retaining all reservations.
// Main contract: retry + smtp_budget_exhausted/unavailable is pre-SMTP deferral:
// undo attempt increment, clear marker, schedule retryAfterSeconds, stop batch.
export type SmtpBudgetResult = ProviderResult & { retryAfterSeconds?: number };

function integer(name: string, minimum: number): number | undefined {
  const raw = process.env[name];
  if (!raw || !/^(0|[1-9][0-9]*)$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum && value <= 10_000_000 ? value : undefined;
}

/** Called only by delivery, outside booking/payment transactions. Never release. */
export async function reserveSmtpBudget(lane: 'legacy' | 'v1'): Promise<SmtpBudgetResult | null> {
  if (process.env.NOTIFICATIONS_EMAIL_V1_ENABLED !== 'true') return null;
  const second = integer('SMTP_BUDGET_PER_SECOND', 1);
  const day = integer('SMTP_BUDGET_PER_DAY', 1);
  const reserveSecond = integer('SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND', 0);
  const reserveDay = integer('SMTP_BUDGET_LEGACY_RESERVE_PER_DAY', 0);
  const scope = process.env.SMTP_BUDGET_SCOPE;
  if (process.env.SMTP_BUDGET_QUOTAS_CONFIRMED !== 'true' || !scope ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(scope) || !process.env.DATABASE_URL ||
      second === undefined || day === undefined || reserveSecond === undefined || reserveDay === undefined ||
      reserveSecond >= second || reserveDay >= day) {
    return { status: 'not_configured', error: 'smtp_budget_not_configured' };
  }
  const policy = `${second}:${day}:${reserveSecond}:${reserveDay}`;
  let client: PoolClient | undefined;
  let broken = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL statement_timeout = '3s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '3s'");
    await client.query("SET LOCAL synchronous_commit = 'on'");
    await client.query(`INSERT INTO public.notification_smtp_budget_scopes(scope,policy)
      VALUES($1,$2) ON CONFLICT(scope) DO NOTHING`, [scope, policy]);
    const locked = await client.query<{ policy: string }>(
      'SELECT policy FROM public.notification_smtp_budget_scopes WHERE scope=$1 FOR UPDATE', [scope]);
    if (locked.rows[0]?.policy !== policy) {
      await client.query('ROLLBACK');
      return { status: 'not_configured', error: 'smtp_budget_policy_mismatch' };
    }
    // Sample time AFTER scope lock; preserve microseconds and monotonicity if
    // database clock moves backwards. No application clock involved.
    const clock = await client.query<{ at: string }>(`UPDATE public.notification_smtp_budget_scopes
      SET last_reserved_at=GREATEST(clock_timestamp(),last_reserved_at)
      WHERE scope=$1 RETURNING last_reserved_at::text AS at`, [scope]);
    const at = clock.rows[0].at;
    let retryAfterSeconds = 0;
    for (const [window, limit] of [[1, second - (lane === 'v1' ? reserveSecond : 0)],
      [86400, day - (lane === 'v1' ? reserveDay : 0)]]) {
      // Bounded count via (scope,time,id) index. Newest N entries determine
      // earliest safe retry even if legacy has consumed more than the V1 cap.
      const usage = await client.query<{ used: string; wait: number | null }>(`SELECT count(*)::text AS used,
        CEIL(EXTRACT(EPOCH FROM (min(reserved_at) + $3 * interval '1 second' - $2::timestamptz)))::int AS wait
        FROM (SELECT reserved_at FROM public.notification_smtp_budget_reservations
          WHERE scope=$1 AND reserved_at > $2::timestamptz - $3 * interval '1 second'
          ORDER BY reserved_at DESC,id DESC LIMIT $4) recent`, [scope, at, window, limit]);
      if (Number(usage.rows[0].used) >= limit) retryAfterSeconds = Math.max(retryAfterSeconds, usage.rows[0].wait || 1);
    }
    if (retryAfterSeconds > 0) {
      await client.query('COMMIT');
      return { status: 'retry', error: 'smtp_budget_exhausted', retryAfterSeconds };
    }
    // Bounded housekeeping of EXPIRED entries only. Never release live entries.
    await client.query(`DELETE FROM public.notification_smtp_budget_reservations WHERE id IN (
      SELECT id FROM public.notification_smtp_budget_reservations WHERE scope=$1
      AND reserved_at <= $2::timestamptz - interval '24 hours' ORDER BY reserved_at,id LIMIT 1000)`, [scope, at]);
    await client.query(`INSERT INTO public.notification_smtp_budget_reservations(id,scope,reserved_at)
      VALUES($1,$2,$3::timestamptz)`, [randomUUID(), scope, at]);
    await client.query('COMMIT');
    return null;
  } catch {
    // COMMIT may have succeeded without acknowledgement. Never compensate it.
    if (client) { try { await client.query('ROLLBACK'); } catch { broken = true; } }
    return { status: 'retry', error: 'smtp_budget_unavailable', retryAfterSeconds: 60 };
  } finally { client?.release(broken); }
}
