// Real isolated PostgreSQL; SMTP mocked. Never load runtime env or contact providers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');

function load(file, env, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, process: { env }, AbortSignal,
    require: name => { if (name in mocks) return mocks[name]; throw Error(`Unexpected import ${name}`); },
    fetch: () => { throw Error('External network forbidden'); },
  }, { filename: file });
  return exports;
}

async function main() {
  const container = JSON.parse(execFileSync('docker', ['--context', 'default', 'inspect',
    'body-state-notifications-qa-pg'], { encoding: 'utf8' }))[0];
  assert.equal(container.Config.Labels.purpose, 'notifications-isolated-qa');
  const binding = container.NetworkSettings.Ports['5432/tcp'][0];
  assert.equal(binding.HostIp, '127.0.0.1'); assert.ok(['15432', '15435'].includes(binding.HostPort));
  const connection = { host: '127.0.0.1', port: Number(binding.HostPort), user: 'notifications_qa',
    password: 'synthetic_notifications_qa', database: 'notifications_qa', connectionTimeoutMillis: 2000 };
  const admin = new Pool(connection);
  const database = `smtp_budget_qa_${randomUUID().replaceAll('-', '')}`;
  assert.match(database, /^smtp_budget_qa_[a-f0-9]{32}$/);
  const pools = [];
  let created = false;
  let pool;
  const migration = fs.readFileSync('migrations/022_notification_system_v1.sql', 'utf8').split('-- SMTP aggregate budget (Makar).')[1];
  assert.ok(migration);
  function fixture(overrides = {}, injectedPool, outcome) {
    const env = { NOTIFICATIONS_EMAIL_V1_ENABLED: 'true', DATABASE_URL: 'synthetic-isolated-test',
      SMTP_BUDGET_QUOTAS_CONFIRMED: 'true', SMTP_BUDGET_SCOPE: `qa_${randomUUID().replaceAll('-', '')}`,
      SMTP_BUDGET_PER_SECOND: '10', SMTP_BUDGET_PER_DAY: '100',
      SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND: '2', SMTP_BUDGET_LEGACY_RESERVE_PER_DAY: '10',
      SMTP_HOST: 'smtp.example.invalid', SMTP_USER: 'synthetic', SMTP_PASSWORD: 'synthetic',
      SMTP_FROM: 'sender@example.invalid', EMAIL_FROM: 'sender@example.invalid', ...overrides };
    const budget = load('src/lib/notification-smtp-budget.ts', env, {
      'node:crypto': { randomUUID }, '@/lib/db': { pool: injectedPool || pool },
    });
    let sends = 0, transports = 0;
    const api = load('src/lib/notifications.ts', env, {
      '@/lib/notification-smtp-budget': budget,
      '@/lib/notification-result': { providerFailure: () => { throw Error('Unexpected fallback'); } },
      nodemailer: { createTransport: () => { transports++; return { sendMail: async () => {
        sends++; if (outcome) return outcome();
        return { accepted: ['recipient@example.invalid'], messageId: 'synthetic' };
      } }; } },
    });
    return { env, budget, api, sends: () => sends, transports: () => transports,
      legacy: () => api.deliverEmail('recipient@example.invalid', 'Fixture', '<p>Fixture</p>'),
      v1: () => api.deliverTransactionalEmail('recipient@example.invalid', 'Fixture', '<p>Fixture</p>', 'Fixture') };
  }
  const count = async f => Number((await pool.query('SELECT count(*) FROM public.notification_smtp_budget_reservations WHERE scope=$1', [f.env.SMTP_BUDGET_SCOPE])).rows[0].count);
  let passed = 0;
  async function test(name, run) { await run(); passed++; console.log('PASS', name); }
  try {
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    pool = new Pool({ ...connection, database, max: 12 }); pools.push(pool);
    // Only the newly appended budget DDL, in a brand-new database. Apply twice.
    const ddl = '-- SMTP aggregate budget (Makar).' + migration;
    await pool.query(ddl); await pool.query(ddl);
    await test('repeatable migration creates logged durable tables and sorted scope index', async () => {
      const rows = await pool.query("SELECT relpersistence FROM pg_class WHERE oid IN ('public.notification_smtp_budget_scopes'::regclass,'public.notification_smtp_budget_reservations'::regclass)");
      assert.equal(rows.rows.length, 2); assert(rows.rows.every(r => r.relpersistence === 'p'));
      assert.equal((await pool.query("SELECT count(*) FROM pg_indexes WHERE indexname='notification_smtp_budget_scope_time'")).rows[0].count, '1');
    });
    await test('V1 OFF legacy has no DB I/O and keeps recipient lists', async () => {
      const f = fixture({ NOTIFICATIONS_EMAIL_V1_ENABLED: 'false' }, { connect: () => { throw Error('Forbidden'); } });
      assert.equal((await f.legacy()).status, 'accepted');
      assert.equal(await f.api.sendEmail('a@example.invalid,b@example.invalid', 'Fixture', 'Fixture'), true);
      assert.equal((await f.v1()).status, 'not_configured'); assert.equal(f.sends(), 2);
    });
    await test('invalid ENV fails closed before DB I/O on both paths', async () => {
      for (const overrides of [{ SMTP_BUDGET_QUOTAS_CONFIRMED: '' }, { SMTP_BUDGET_SCOPE: '' },
        { DATABASE_URL: '' }, { SMTP_BUDGET_PER_SECOND: '0' }, { SMTP_BUDGET_PER_DAY: '1e3' },
        { SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND: '10' }, { SMTP_BUDGET_LEGACY_RESERVE_PER_DAY: '-1' }]) {
        const f = fixture(overrides, { connect: () => { throw Error('Forbidden'); } });
        assert.equal((await f.v1()).status, 'not_configured');
        assert.equal((await f.legacy()).status, 'not_configured'); assert.equal(f.sends(), 0);
      }
    });
    await test('parallel workers share one durable budget plus bounded legacy reserve', async () => {
      // Hold logical PG time in the future so test duration cannot cross 1s.
      const f = fixture(); const otherPool = new Pool({ ...connection, database, max: 6 }); pools.push(otherPool);
      await pool.query("INSERT INTO public.notification_smtp_budget_scopes(scope,policy,last_reserved_at) VALUES($1,'10:100:2:10',clock_timestamp()+interval '1 minute')", [f.env.SMTP_BUDGET_SCOPE]);
      const g = fixture({ ...f.env }, otherPool);
      const results = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? f : g).v1()));
      assert.equal(results.filter(r => r.status === 'accepted').length, 8);
      assert.equal((await f.legacy()).status, 'accepted'); assert.equal((await g.legacy()).status, 'accepted');
      assert.equal((await f.legacy()).error, 'smtp_budget_exhausted'); assert.equal(await count(f), 10);
    });
    await test('24h cap returns due time without SMTP and preserves daily legacy reserve', async () => {
      const f = fixture({ SMTP_BUDGET_PER_SECOND: '100', SMTP_BUDGET_PER_DAY: '5',
        SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND: '0', SMTP_BUDGET_LEGACY_RESERVE_PER_DAY: '2' });
      for (let i = 0; i < 3; i++) assert.equal((await f.v1()).status, 'accepted');
      const denied = await f.v1(); assert.equal(denied.error, 'smtp_budget_exhausted');
      assert(denied.retryAfterSeconds >= 86390 && denied.retryAfterSeconds <= 86400);
      for (let i = 0; i < 2; i++) assert.equal((await f.legacy()).status, 'accepted');
      assert.equal((await f.legacy()).error, 'smtp_budget_exhausted'); assert.equal(f.sends(), 5);
    });
    await test('legacy first consumes quota visible to V1; scope isolation', async () => {
      const f = fixture({ SMTP_BUDGET_PER_SECOND: '100', SMTP_BUDGET_PER_DAY: '3',
        SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND: '0', SMTP_BUDGET_LEGACY_RESERVE_PER_DAY: '1' });
      assert.equal((await f.legacy()).status, 'accepted'); assert.equal((await f.v1()).status, 'accepted');
      assert.equal((await f.v1()).error, 'smtp_budget_exhausted'); assert.equal((await f.legacy()).status, 'accepted');
      assert.equal((await fixture().v1()).status, 'accepted');
    });
    await test('SMTP unknown outcome and explicit rejection never release reservations', async () => {
      for (const properties of [{}, { responseCode: 550 }]) {
        const f = fixture({}, undefined, () => { throw Object.assign(new Error('Synthetic'), properties); });
        assert.equal((await f.v1()).status, properties.responseCode ? 'failed' : 'uncertain');
        assert.equal(await count(f), 1);
      }
    });
    await test('scope policy disagreement fails closed retaining usage', async () => {
      const f = fixture(); assert.equal((await f.v1()).status, 'accepted');
      f.env.SMTP_BUDGET_PER_DAY = '101';
      assert.equal((await f.legacy()).error, 'smtp_budget_policy_mismatch'); assert.equal(await count(f), 1);
    });
    await test('pool reconnect preserves reservations without restart quarantine', async () => {
      const f = fixture({ SMTP_BUDGET_PER_DAY: '1', SMTP_BUDGET_LEGACY_RESERVE_PER_DAY: '0' });
      assert.equal((await f.v1()).status, 'accepted');
      const reconnected = new Pool({ ...connection, database }); pools.push(reconnected);
      const g = fixture({ ...f.env }, reconnected);
      assert.equal((await g.v1()).error, 'smtp_budget_exhausted'); assert.equal(g.sends(), 0);
      assert.equal((await fixture({}, reconnected).v1()).status, 'accepted');
    });
    await test('1s scope lock timeout defers without SMTP or extra reservation', async () => {
      const f = fixture(); assert.equal((await f.v1()).status, 'accepted');
      const blocker = await pool.connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT scope FROM public.notification_smtp_budget_scopes WHERE scope=$1 FOR UPDATE', [f.env.SMTP_BUDGET_SCOPE]);
        const start = Date.now(); const result = await f.v1();
        assert.equal(result.error, 'smtp_budget_unavailable'); assert.equal(result.retryAfterSeconds, 60);
        assert(Date.now() - start >= 900 && Date.now() - start < 4000);
        assert.equal(f.sends(), 1);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      assert.equal(await count(f), 1);
    });
    function wrappedPool(intercept, onRelease = () => {}) {
      return { connect: async () => {
        const c = await pool.connect();
        return { query: async (sql, values) => intercept(c, sql, values),
          release: broken => { onRelease(); c.release(broken); } };
      } };
    }
    await test('3s SQL statement timeout rolls back and defers', async () => {
      const injected = wrappedPool(async (c, sql, values) => {
        if (sql.startsWith('SELECT policy')) await c.query('SELECT pg_sleep(4)');
        return c.query(sql, values);
      });
      const f = fixture({}, injected);
      assert.equal((await f.v1()).error, 'smtp_budget_unavailable'); assert.equal(f.sends(), 0);
      assert.equal(await count(f), 0);
    });
    await test('lost COMMIT acknowledgement retains durable reservation; no SMTP', async () => {
      const injected = wrappedPool(async (c, sql, values) => {
        const result = await c.query(sql, values);
        if (sql === 'COMMIT') throw Error('Synthetic acknowledgement loss');
        return result;
      });
      const f = fixture({}, injected);
      assert.equal((await f.v1()).error, 'smtp_budget_unavailable'); assert.equal(f.sends(), 0);
      assert.equal(await count(f), 1);
    });
    await test('deadline expires while budget awaits SQL: late admission never creates SMTP transport', async () => {
      let unblock, committed;
      const held = new Promise(resolve => { unblock = resolve; });
      const commitSeen = new Promise(resolve => { committed = resolve; });
      const injected = wrappedPool(async (c, sql, values) => {
        const result = await c.query(sql, values);
        if (sql === 'COMMIT') { committed(); await held; }
        return result;
      });
      const f = fixture({}, injected);
      const deadlineAt = Date.now() + 150;
      const pending = f.api.deliverTransactionalEmail('recipient@example.invalid', 'Fixture',
        '<p>Fixture</p>', 'Fixture', { deadlineAt });
      let timer;
      try {
        // Model caller Promise.race expiring while the committed SQL reservation
        // is still awaiting acknowledgement; do not cancel the adapter promise.
        const caller = Promise.race([pending, new Promise(resolve => {
          timer = setTimeout(() => resolve('caller_deadline'), Math.max(0, deadlineAt - Date.now()));
        })]);
        await commitSeen;
        assert.equal(await caller, 'caller_deadline');
        assert.equal(await count(f), 1);
        assert.equal(f.transports(), 0); assert.equal(f.sends(), 0);
      } finally { clearTimeout(timer); unblock(); }
      const late = await pending;
      assert.equal(late.status, 'retry'); assert.equal(late.error, 'smtp_budget_unavailable');
      assert.equal(f.transports(), 0); assert.equal(f.sends(), 0);
      assert.equal(await count(f), 1, 'late reservation must remain consumed');
    });
    await test('connection unavailable defers; SMTP starts only after transaction release', async () => {
      const f = fixture({}, { connect: async () => { throw Error('Synthetic'); } });
      assert.equal((await f.legacy()).error, 'smtp_budget_unavailable'); assert.equal(f.sends(), 0);
      let released = false;
      const g = fixture({}, wrappedPool((c, sql, values) => c.query(sql, values), () => { released = true; }),
        () => { assert(released); return { accepted: ['recipient@example.invalid'] }; });
      assert.equal((await g.v1()).status, 'accepted');
    });
    await test('expired rows pruned in bounded batches; active rows untouched', async () => {
      const f = fixture(); assert.equal((await f.v1()).status, 'accepted');
      await pool.query("INSERT INTO public.notification_smtp_budget_reservations(id,scope,reserved_at) SELECT md5(i::text)::uuid,$1,clock_timestamp()-interval '25 hours' FROM generate_series(1,1005) i", [f.env.SMTP_BUDGET_SCOPE]);
      assert.equal((await f.legacy()).status, 'accepted'); assert.equal(await count(f), 7);
      assert.equal((await f.v1()).status, 'accepted'); assert.equal(await count(f), 3);
    });
    await test('legacy recipient lists rejected before reserving when V1 ON', async () => {
      const f = fixture();
      assert.equal((await f.api.deliverEmail('a@example.invalid,b@example.invalid', 'Fixture', 'Fixture')).status, 'failed');
      assert.equal(f.sends(), 0); assert.equal(await count(f), 0);
    });
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
    const program = ts.createProgram(['src/lib/notification-smtp-budget.ts', 'src/lib/notifications.ts'],
      { ...parsed.options, incremental: false, noEmit: true });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: ts.sys.getCurrentDirectory, getCanonicalFileName: f => f, getNewLine: () => '\n',
    }));
    console.log(`PASS focused tsc; ${passed} real PG + SMTP mock tests`);
  } finally {
    await Promise.all(pools.map(p => p.end()));
    // Only the exact uniquely named database created by this test is removed.
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
