// Real PostgreSQL integration. Only the dedicated Docker QA container is allowed.
// Run: node tests/notification-core.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const docker = (...args) => execFileSync('docker', ['--context', 'default', ...args], { encoding: 'utf8' }).trim();
const container = JSON.parse(docker('inspect', 'body-state-notifications-qa-pg'))[0];
assert.equal(container.Config.Labels.purpose, 'notifications-isolated-qa');
const binding = container.NetworkSettings.Ports['5432/tcp'][0];
assert.equal(binding.HostIp, '127.0.0.1');
assert.ok(['15432', '15435'].includes(binding.HostPort));
const admin = new Pool({ host: '127.0.0.1', port: Number(binding.HostPort), user: 'notifications_qa', password: 'synthetic_notifications_qa', database: 'notifications_qa' });
const database = `audit_regression_${Date.now()}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-core-qa-'));
const env = { NOTIFICATIONS_EMAIL_V1_ENABLED: 'true', NOTIFICATIONS_MAX_V1_ENABLED: 'false', NOTIFICATIONS_EMAIL_V1_ACTIVE_SINCE:'2026-01-01T00:00:00Z', NOTIFICATIONS_MAX_V1_ACTIVE_SINCE:'2026-01-01T00:00:00Z' };
let pool, core, db, protectedRows;
const results = [];
const forbidden = () => { throw Error('External provider/network forbidden'); };
const mocks = {
  '@/lib/notifications': { deliverTransactionalEmail: forbidden },
  '@/lib/max-notifications': { deliverMax: forbidden },
  '@/lib/legal': { legalDetails: {} }, '@/lib/service-prices': { getServicePrice: forbidden },
  '@/lib/promo-codes': { validatePromoCode: forbidden },
};
function load(name) {
  const alias = `@/lib/${name}`;
  if (mocks[alias]) return mocks[alias];
  const file = path.join(root, 'src/lib', `${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const compiled = path.join(temp, `${name}.cjs`);
  fs.writeFileSync(compiled, output.outputText);
  const exports = {};
  vm.runInNewContext(fs.readFileSync(compiled, 'utf8'), { exports, process: { env }, Buffer, URL, Date, console,
    setTimeout, clearTimeout, fetch: forbidden,
    require: key => key.startsWith('@/lib/') ? load(key.slice(6)) : ['node:crypto','crypto'].includes(key) ? require(key) : (() => { throw Error(`Unexpected import ${key}`); })(),
  }, { filename: compiled });
  mocks[alias] = exports;
  return exports;
}
async function legacySnapshot() {
  return (await pool.query("SELECT to_jsonb(n) data FROM appointment_notifications n WHERE engine='legacy' ORDER BY id")).rows;
}
async function row(id) { return (await pool.query('SELECT * FROM appointment_notifications WHERE id=$1', [id])).rows[0]; }
async function booking(status = 'confirmed', hours = 48) {
  const slot = (await pool.query("INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES('bfm',now()+$1*interval '1 hour',60) RETURNING id", [hours])).rows[0].id;
  return (await pool.query("INSERT INTO bfm_bookings(slot_id,client_name,client_phone,client_email,status,payment_status) VALUES($1,'Synthetic QA','+79990000000','qa@example.invalid',$2,'paid') RETURNING id", [slot, status])).rows[0].id;
}
async function enqueue(id, kind = 'confirmed', options) {
  await db.transaction(c => core.enqueueBookingNotification(c, 'bfm', id, kind, options));
  return (await pool.query("SELECT id FROM appointment_notifications WHERE engine='v1' AND booking_id=$1 ORDER BY created_at DESC LIMIT 1", [id])).rows[0]?.id;
}
function providers(fn = async () => ({ status: 'accepted', id: 'fake-provider-id' })) { return { email: fn, max: forbidden }; }
async function test(name, fn) {
  await pool.query("DELETE FROM appointment_notifications WHERE engine='v1'");
  env.NOTIFICATIONS_EMAIL_V1_ENABLED = 'true'; env.NOTIFICATIONS_MAX_V1_ENABLED = 'false';
  try { await fn(); assert.deepEqual(await legacySnapshot(), protectedRows); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, ok: false }); console.error('FAIL', name, e.stack); }
}
async function main() {
  await admin.query(`CREATE DATABASE ${database}`);
  pool = new Pool({ host: '127.0.0.1', port: Number(binding.HostPort), user: 'notifications_qa', password: 'synthetic_notifications_qa', database, max: 10 });
  db = { transaction: async fn => { const c = await pool.connect(); try { await c.query('BEGIN'); const v = await fn(c); await c.query('COMMIT'); return v; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } } };
  mocks['@/lib/db'] = { db, pool };
  const migrations = fs.readdirSync(path.join(root, 'migrations')).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  await pool.query('CREATE TABLE schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of migrations) {
    if (file.startsWith('022')) {
      for (let i = 0; i < 9; i++) await pool.query("INSERT INTO appointment_notifications(booking_id,service_type,event_type,revision,channel,scheduled_at,status,attempts,last_error,processing_at) VALUES($1,'bfm','confirmed',0,'email',now()-interval '1 day',$2,4,'qa_protected',now()-interval '1 day')", [crypto.randomUUID(), i < 5 ? 'uncertain' : 'failed']);
      protectedRows = (await pool.query("SELECT to_jsonb(n)||'{\"engine\":\"legacy\",\"event_key\":null,\"account_user_id\":null,\"payload\":{}}'::jsonb data FROM appointment_notifications n ORDER BY id")).rows;
    }
    await db.transaction(async c => { await c.query(fs.readFileSync(path.join(root, 'migrations', file), 'utf8')); await c.query('INSERT INTO schema_migrations(filename) VALUES($1)', [file]); });
  }
  // New nullable columns may be added by 022; compare every pre-existing field.
  const migrated = await legacySnapshot();
  for (let i = 0; i < protectedRows.length; i++) for (const [key, value] of Object.entries(protectedRows[i].data)) assert.deepEqual(migrated[i].data[key], value, `migration changed legacy ${key}`);
  protectedRows = migrated;
  console.log('PASS migrations 001..022; protected legacy 5 uncertain + 4 failed unchanged');
  core = load('notification-core');
  console.log('CORE_SHA256', crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src/lib/notification-core.ts'))).digest('hex'));
  console.log('MIGRATION022_SHA256', crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'migrations/022_notification_system_v1.sql'))).digest('hex'));
  await test('flags OFF: enqueue and worker are inert', async () => {
    const id = await booking(); const queued = await enqueue(id);
    const before = await row(queued); env.NOTIFICATIONS_EMAIL_V1_ENABLED = 'false';
    await enqueue(await booking()); await core.scheduleV1Reminders({}, 'bfm', id);
    assert.equal((await core.processV1Notifications(20, providers(forbidden))).processed, 0);
    assert.deepEqual(await row(queued), before);
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE engine='v1'")).rows[0].n, 1);
  });
  await test('transaction rollback removes business mutation and outbox; no send before commit', async () => {
    const id = await booking('pending'); let calls = 0;
    await assert.rejects(db.transaction(async c => {
      await c.query("UPDATE bfm_bookings SET status='confirmed' WHERE id=$1", [id]);
      await core.enqueueBookingNotification(c, 'bfm', id, 'confirmed');
      assert.equal((await core.processV1Notifications(10, providers(async () => { calls++; return { status: 'accepted' }; }))).processed, 0);
      throw Error('rollback-marker');
    }), /rollback-marker/);
    assert.equal(calls, 0);
    assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1', [id])).rows[0].status, 'pending');
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE engine='v1'")).rows[0].n, 0);
    await db.transaction(async c => { await c.query("UPDATE bfm_bookings SET status='confirmed' WHERE id=$1", [id]); await core.enqueueBookingNotification(c, 'bfm', id, 'confirmed'); });
    assert.equal((await core.processV1Notifications(10, providers())).processed, 1);
  });
  await test('20 concurrent workers claim 20 distinct rows exactly once', async () => {
    for (let i = 0; i < 20; i++) await enqueue(await booking());
    let calls = 0;
    await Promise.all(Array.from({ length: 20 }, () => core.processV1Notifications(1, providers(async () => { calls++; await new Promise(r => setTimeout(r, 10)); return { status: 'accepted' }; }))));
    assert.equal(calls, 20);
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE engine='v1' AND status='accepted' AND attempts=1")).rows[0].n, 20);
  });
  await test('logical paid dedupe survives booking revision changes', async () => {
    const id = await booking();
    await Promise.all(Array.from({ length: 10 }, () => enqueue(id, 'paid')));
    await pool.query('UPDATE bfm_bookings SET notification_revision=notification_revision+1 WHERE id=$1', [id]);
    await enqueue(id, 'paid');
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE engine='v1' AND booking_id=$1 AND event_type='paid'", [id])).rows[0].n, 1);
  });
  await test('paid stable settlement key dedupes concurrent replay across revisions', async () => {
    const id = await booking(); const options = { key: `paid:bfm:${id}:synthetic-order` };
    await Promise.all(Array.from({ length: 10 }, () => enqueue(id, 'paid', options)));
    await pool.query('UPDATE bfm_bookings SET notification_revision=notification_revision+1 WHERE id=$1', [id]);
    await enqueue(id, 'paid', options);
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE engine='v1' AND booking_id=$1", [id])).rows[0].n, 1);
    let calls = 0; await core.processV1Notifications(20, providers(async () => { calls++; return { status: 'accepted' }; }));
    assert.equal(calls, 1);
  });
  await test('reminders stale revision / cancelled / completed / overdue never dispatch', async () => {
    for (const mode of ['revision', 'cancelled', 'completed', 'overdue']) {
      const id = await booking(); const notification = await enqueue(id, 'reminder_2h', { at: new Date(Date.now() - (mode === 'overdue' ? 6 * 60000 : 1000)) });
      if (mode === 'revision') await pool.query('UPDATE bfm_bookings SET notification_revision=notification_revision+1 WHERE id=$1', [id]);
      if (['cancelled', 'completed'].includes(mode)) await pool.query('UPDATE bfm_bookings SET status=$2 WHERE id=$1', [id, mode]);
      await core.processV1Notifications(1, providers(forbidden)); assert.equal((await row(notification)).status, 'cancelled');
    }
  });
  await test('reminder schedule 24h/2h; no catch-up; valid reminder delivered', async () => {
    const id = await booking(); await db.transaction(c => core.scheduleV1Reminders(c, 'bfm', id));
    assert.equal((await pool.query("SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1", [id])).rows[0].n, 2);
    const near = await booking('confirmed', 1); await db.transaction(c => core.scheduleV1Reminders(c, 'bfm', near));
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1', [near])).rows[0].n, 0);
    const due = await enqueue(await booking(), 'reminder_2h', { at: new Date(Date.now() - 1000) });
    await core.processV1Notifications(10, providers()); assert.equal((await row(due)).status, 'accepted');
  });
  await test('retry exponential backoff; fourth attempt dead-letter; no manual retry', async () => {
    const id = await enqueue(await booking());
    for (let attempt = 1; attempt <= 4; attempt++) {
      await core.processV1Notifications(1, providers(async () => ({ status: 'retry', error: 'provider_unavailable' })));
      const r = await row(id); assert.equal(r.attempts, attempt); assert.equal(r.status, attempt === 4 ? 'failed' : 'retry');
      const delta = r.next_attempt_at.getTime() - Date.now(); assert.ok(delta > 60 * 2 ** (attempt - 1) * 1000 - 5000);
      assert.equal((await core.processV1Notifications(1, providers(forbidden))).processed, 0);
      await pool.query('UPDATE appointment_notifications SET next_attempt_at=now() WHERE id=$1', [id]);
    }
    assert.equal((await row(id)).last_error, 'attempts_exhausted'); assert.equal(await core.retryV1Notification(id), false);
  });
  await test('timeout outcome uncertain; late acceptance does not auto-retry', async () => {
    const id = await enqueue(await booking()); let calls = 0;
    await core.processV1Notifications(1, providers(async () => { calls++; await new Promise(r => setTimeout(r, 40)); return { status: 'accepted' }; }), 5);
    await new Promise(r => setTimeout(r, 50));
    assert.equal((await row(id)).status, 'uncertain'); assert.equal((await row(id)).last_error, 'provider_outcome_unknown');
    assert.equal(await core.retryV1Notification(id), false);
    await core.processV1Notifications(20, providers(forbidden)); assert.equal(calls, 1); assert.equal((await row(id)).attempts, 1);
  });
  await test('interrupted processing after send marker stays uncertain without sending', async () => {
    const id = await enqueue(await booking());
    await pool.query("UPDATE appointment_notifications SET status='processing',attempts=1,processing_at=now()-interval '6 minutes',send_started_at=now()-interval '6 minutes' WHERE id=$1", [id]);
    await core.processV1Notifications(10, providers(forbidden)); assert.equal((await row(id)).status, 'uncertain');
    assert.equal((await row(id)).last_error, 'worker_interrupted');
  });
  await test('interrupted processing before send marker safely retries with bounded budget',async()=>{
    const id=await enqueue(await booking());
    await pool.query("UPDATE appointment_notifications SET status='processing',attempts=1,processing_at=now()-interval '6 minutes' WHERE id=$1",[id]);
    await core.processV1Notifications(10,providers(forbidden));assert.equal((await row(id)).status,'retry');
    await pool.query('UPDATE appointment_notifications SET next_attempt_at=now() WHERE id=$1',[id]);
    await core.processV1Notifications(10,providers());assert.equal((await row(id)).status,'accepted');
  });
  await test('legacy 24h email coverage prevents a second V1 email reminder',async()=>{
    const id=await booking();
    await pool.query("INSERT INTO appointment_notifications(booking_id,service_type,event_type,revision,channel,scheduled_at,status) VALUES($1,'bfm','reminder',0,'email',now()+interval '24 hours','accepted')",[id]);
    // This new synthetic legacy row is part of this test's protected baseline.
    protectedRows=await legacySnapshot();
    await db.transaction(c=>core.scheduleV1Reminders(c,'bfm',id));
    const rows=await pool.query("SELECT event_type FROM appointment_notifications WHERE booking_id=$1 AND engine='v1'",[id]);
    assert.deepEqual(rows.rows.map(r=>r.event_type),['reminder_2h']);
  });
  await test('real PG reset issuance is serialized; only one live hash, no token in outbox',async()=>{
    env.NOTIFICATION_RESET_KEY='synthetic-reset-key-at-least-32-bytes-only';
    const account=(await pool.query("INSERT INTO account_users(display_name,email,username,consent_version,consent_at,verified_at) VALUES('Synthetic QA','reset@example.invalid','resetqa','qa',now(),now()) RETURNING id",[])).rows[0].id;
    const reset=load('notification-reset');
    await Promise.all(Array.from({length:5},()=>db.transaction(c=>reset.enqueuePasswordReset(c,'reset@example.invalid'))));
    const tokens=await pool.query('SELECT id,token_hash FROM account_password_reset_tokens WHERE account_user_id=$1 AND used_at IS NULL',[account]);
    assert.equal(tokens.rowCount,1);
    const token=reset.deriveResetToken(tokens.rows[0].id);
    assert.equal(reset.resetTokenHash(token),tokens.rows[0].token_hash);
    const payloads=await pool.query("SELECT payload FROM appointment_notifications WHERE account_user_id=$1",[account]);
    assert.equal(payloads.rowCount,5);assert(!JSON.stringify(payloads.rows).includes(token));
    let sends=0;await core.processV1Notifications(10,providers(async(to,subject,html,text)=>{sends++;assert(text.includes(token));return {status:'accepted'};}));
    assert.equal(sends,1);
    const routeExports={};
    const source=ts.transpileModule(fs.readFileSync(path.join(root,'src/app/api/account/password-reset/confirm/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    vm.runInNewContext(source,{exports:routeExports,process:{env},Buffer,console,require:key=>{
      if(key==='next/server')return {NextResponse:{json:(body,options)=>Response.json(body,options)}};
      if(key==='next/headers')return {cookies:async()=>({set(){}})};
      if(key==='@/lib/account-auth')return {ACCOUNT_COOKIE:'account_session'};
      if(key==='@/lib/request')return {enforceRateLimit:async()=>null,readJsonObject:async request=>request.json()};
      if(key.startsWith('@/lib/'))return load(key.slice(6));
      return require(key);
    }});
    const request=()=>new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:'Synthetic-QA-password-42',password_confirmation:'Synthetic-QA-password-42'})});
    const replies=await Promise.all([routeExports.POST(request()),routeExports.POST(request())]);
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);
    assert.equal((await pool.query('SELECT session_version FROM account_users WHERE id=$1',[account])).rows[0].session_version,2);
    assert.equal((await pool.query("SELECT id FROM appointment_notifications WHERE account_user_id=$1 AND event_type='password_changed'",[account])).rowCount,1);
  });
  await test('MAX real PG inbox/pairing/admin-confirm are durable and role separated',async()=>{
    env.NOTIFICATIONS_MAX_V1_ENABLED='true';env.MAX_BOT_URL='https://max.ru/synthetic_qa_bot';
    delete mocks['@/lib/max-notifications'];
    const max=load('max-notifications'),adminBinding=load('max-admin-binding');
    const user=(await pool.query("INSERT INTO account_users(display_name,email,username,consent_version,consent_at,verified_at) VALUES('Synthetic MAX','max@example.invalid','maxqa','qa',now(),now()) RETURNING id")).rows[0].id;
    const pair=await max.createMaxPairing(user);
    const update={key:crypto.createHash('sha256').update('synthetic-max-1').digest('hex'),userId:'123',chatId:'456',timestamp:Date.now(),code:pair.code};
    const accepted=await Promise.all([max.acceptMaxUpdate(update),max.acceptMaxUpdate(update)]);
    assert.equal(accepted.filter(r=>r.duplicate===false).length,1);
    assert.equal((await pool.query('SELECT max_chat_id FROM max_account_bindings WHERE account_user_id=$1',[user])).rows[0].max_chat_id,'456');
    const adminPair=await adminBinding.createMaxAdminPairing();
    await max.acceptMaxUpdate({...update,key:crypto.createHash('sha256').update('synthetic-max-admin').digest('hex'),userId:'789',chatId:'987',code:adminPair.code,timestamp:Date.now()});
    assert.equal((await pool.query('SELECT * FROM max_admin_binding')).rowCount,0,'webhook alone cannot grant admin delivery');
    assert.equal(await adminBinding.confirmMaxAdminBinding('wrong','987'),false);
    assert.equal(await adminBinding.confirmMaxAdminBinding('789','987'),true);
    assert.equal(await adminBinding.confirmMaxAdminBinding('789','987'),false);
    await adminBinding.revokeMaxAdminBinding();await max.unlinkMax(user);
    assert.equal((await pool.query('SELECT * FROM max_account_bindings WHERE account_user_id=$1',[user])).rowCount,0);
    env.NOTIFICATIONS_MAX_V1_ENABLED='false';
  });
  await test('no catch-up of old events and monotonic durable activation boundary',async()=>{
    const id=await enqueue(await booking());
    await pool.query("UPDATE appointment_notifications SET created_at=now()-interval '31 minutes' WHERE id=$1",[id]);
    await core.processV1Notifications(10,providers(forbidden));assert.equal((await row(id)).status,'cancelled');
    const pending=await enqueue(await booking());
    env.NOTIFICATIONS_EMAIL_V1_ACTIVE_SINCE=new Date().toISOString();
    await core.processV1Notifications(10,providers(forbidden));assert.equal((await row(pending)).status,'cancelled');
    env.NOTIFICATIONS_EMAIL_V1_ACTIVE_SINCE='2026-01-01T00:00:00Z';
    assert.equal(await enqueue(await booking()),undefined,'older epoch cannot reopen old channel generation');
  });
  console.log(JSON.stringify({ database, temp, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results }));
  if (results.some(r => !r.ok)) process.exitCode = 1;
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => { if (pool) await pool.end(); await admin.end(); });
