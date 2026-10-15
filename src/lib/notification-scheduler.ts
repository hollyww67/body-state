import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { processV1Notifications } from '@/lib/notification-core';

// No external I/O inside admission/finalization transactions. An interrupted run
// fails closed: its durable active_run is NOT cleared by a lease timeout.
export async function runNotificationMinute(
  occurrence: string,
  worker = () => processV1Notifications(10, undefined, 10_000, 20_000),
) {
  if (process.env.NOTIFICATIONS_V1_SCHEDULER_ENABLED !== 'true') return { state: 'disabled' as const };
  if (!/^\d{8,12}$/.test(occurrence)) return { state: 'invalid' as const };
  const runId = randomUUID();
  const admission = await db.transaction(async client => {
    await client.query("SET LOCAL statement_timeout='3s'");
    await client.query("SET LOCAL lock_timeout='1s'");
    const minute = Number((await client.query('SELECT floor(extract(epoch FROM clock_timestamp())/60)::bigint AS minute')).rows[0].minute);
    if (String(minute) !== occurrence) return 'invalid' as const; // never catch up
    const control = (await client.query('SELECT * FROM notification_worker_control WHERE singleton=true FOR UPDATE')).rows[0];
    if (!control || control.paused) return 'paused' as const;
    if (control.active_run) return 'blocked' as const;
    if (control.last_minute !== null && Number(control.last_minute) >= minute) return 'duplicate' as const;
    const claimed = await client.query(`INSERT INTO notification_worker_runs(occurrence_minute,run_id,status)
      VALUES($1,$2,'running') ON CONFLICT DO NOTHING RETURNING run_id`, [minute, runId]);
    if (!claimed.rowCount) return 'duplicate' as const;
    await client.query('UPDATE notification_worker_control SET last_minute=$1,active_run=$2 WHERE singleton=true', [minute, runId]);
    return 'claimed' as const;
  });
  if (admission !== 'claimed') return { state: admission };
  try {
    const result = await worker();
    await db.transaction(async client => {
      await client.query("SET LOCAL statement_timeout='3s'");
      await client.query(`UPDATE notification_worker_runs SET status='done',finished_at=now(),processed=$2
        WHERE run_id=$1 AND status='running'`, [runId, result.processed]);
      await client.query('UPDATE notification_worker_control SET active_run=NULL WHERE singleton=true AND active_run=$1', [runId]);
    });
    return { state: 'done' as const, processed: result.processed };
  } catch {
    // Failure to persist even this marker still leaves active_run blocking reuse.
    await db.transaction(async client => {
      await client.query("SET LOCAL statement_timeout='3s'");
      await client.query("UPDATE notification_worker_runs SET status='uncertain',finished_at=now() WHERE run_id=$1 AND status='running'", [runId]);
      await client.query('UPDATE notification_worker_control SET paused=true WHERE singleton=true AND active_run=$1', [runId]);
    });
    return { state: 'uncertain' as const };
  }
}
