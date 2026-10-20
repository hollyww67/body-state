// Offline route/transaction contract tests: no DB, Redis, SMTP or live providers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, mocks, env) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    process: { env }, Buffer, URL, console: { error() {} } }, { filename: file });
  return exports;
}
async function main() {
  const env = { NOTIFICATIONS_EMAIL_V1_ENABLED: 'true', NOTIFICATION_RESET_KEY: 'offline-test-key-32-bytes-minimum!' };
  let events = [], tokens = [], queries = [], failQueue = false, accountExists = true, disabled = false;
  const core = { enqueueAccountNotification: async (_client, user, event, key, payload) => {
    if (failQueue) throw Error('offline queue failure');
    events.push({ user, event, key, payload });
  } };
  const helper = load('src/lib/notification-reset.ts', { '@/lib/notification-core': core }, env);
  const id = crypto.randomUUID();
  const token = helper.deriveResetToken(id);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(token, crypto.createHmac('sha256', env.NOTIFICATION_RESET_KEY).update(id).digest('base64url'));
  assert.equal(helper.createNotificationResetToken(id), token);
  assert.notEqual(helper.deriveResetToken(crypto.randomUUID()), token);
  assert.throws(() => helper.deriveResetToken('bad'));
  env.NOTIFICATION_RESET_KEY = 'short';
  assert.throws(() => helper.deriveResetToken(id), /RESET_KEY_NOT_CONFIGURED/);
  env.NOTIFICATION_RESET_KEY = 'offline-test-key-32-bytes-minimum!';
  const client = { query: async (sql, args = []) => {
    queries.push(sql);
    if (sql.includes('SELECT id::text, email FROM account_users')) return { rows: accountExists ? [{ id: 'account', email: 'qa@example.invalid' }] : [] };
    if (sql.includes('INSERT INTO account_password_reset_tokens')) { tokens.push({ id: args[0], account_user_id: args[1], hash: args[2], used: false, expired: false }); return { rows: [] }; }
    if (sql.startsWith('SELECT account_user_id')) return { rows: tokens.filter(t => t.hash === args[0]).map(t => ({ account_user_id: t.account_user_id })) };
    if (sql.startsWith('SELECT id FROM account_users')) return { rowCount: disabled ? 0 : 1, rows: [] };
    if (sql.includes('FROM account_password_reset_tokens') && sql.includes('FOR UPDATE')) return { rows: tokens.filter(t => t.hash === args[0] && !t.used && !t.expired) };
    if (sql.startsWith('UPDATE account_users')) return { rowCount: 1 };
    if (sql.startsWith('UPDATE account_password_reset_tokens')) { tokens.forEach(t => { t.used = true; }); return { rows: [] }; }
    throw Error(`Unexpected SQL: ${sql}`);
  } };
  let tail = Promise.resolve();
  const db = { transaction: callback => {
    const run = tail.then(async () => {
      const savedTokens = structuredClone(tokens), savedEvents = structuredClone(events);
      try { return await callback(client); }
      catch (error) { tokens = savedTokens; events = savedEvents; throw error; }
    });
    tail = run.catch(() => {}); return run;
  } };
  const response = { json: (body, options = {}) => ({ body, status: options.status || 200 }) };
  let limited = false, targetAllowed = true, smtpCalls = 0, cookieCleared = 0;
  const mocks = {
    '@/lib/notification-templates': require('./fixtures/load-email-templates.cjs')(),
    '@/lib/notification-core': core, '@/lib/notification-reset': helper,
    '@/lib/db': { db, pool: { query: async () => { throw Error('Unexpected legacy SQL'); } } },
    'next/server': { NextResponse: response },
    'next/headers': { cookies: async () => ({ set: () => { cookieCleared++; } }) },
    '@/lib/account-auth': { ACCOUNT_COOKIE: 'account_session' },
    '@/lib/account-credentials': { validatePassword: value => ({ password: value, error: null }) },
    bcryptjs: { hash: async () => 'offline-bcrypt-hash' },
    '@/lib/notifications': { isEmailConfigured: () => true, sendEmail: async () => { smtpCalls++; return true; } },
    '@/lib/request': { enforceRateLimit: async () => limited ? response.json({}, { status: 429 }) : null,
      readJsonObject: async r => r, cleanText: value => value },
    '@/lib/rate-limit': { checkRateLimit: async () => targetAllowed },
  };
  const request = load('src/app/api/account/password-reset/request/route.ts', mocks, env);
  const confirm = load('src/app/api/account/password-reset/confirm/route.ts', mocks, env);
  assert.equal((await request.POST({ identity: 'qa@example.invalid' })).status, 200);
  assert.equal(events[0].event, 'reset_requested');
  assert.deepEqual(Object.keys(events[0].payload), ['resetId']);
  assert.equal(tokens[0].hash, helper.resetTokenHash(helper.deriveResetToken(events[0].payload.resetId)));
  assert.equal(JSON.stringify(events).includes(helper.deriveResetToken(tokens[0].id)), false);
  assert.equal(smtpCalls, 0);
  assert.match(queries[0], /account_users[\s\S]*FOR UPDATE/);
  accountExists = false;
  const neutral = await request.POST({ identity: 'missing@example.invalid' });
  assert.equal(neutral.status, 200); assert.equal(events.length, 1);
  accountExists = true;
  await Promise.all([request.POST({ identity: 'qa@example.invalid' }), request.POST({ identity: 'qa@example.invalid' })]);
  assert.equal(tokens.filter(t => !t.used).length, 1); // Transaction contract; PostgreSQL concurrency tested separately.
  failQueue = true;
  const before = JSON.stringify(tokens);
  assert.equal((await request.POST({ identity: 'qa@example.invalid' })).status, 503);
  assert.equal(JSON.stringify(tokens), before);
  failQueue = false;
  const active = tokens.find(t => !t.used);
  const body = { token: helper.deriveResetToken(active.id), password: 'Good-password-123', password_confirmation: 'Good-password-123' };
  active.expired = true;
  assert.equal((await confirm.POST(body)).status, 400); active.expired = false;
  disabled = true; assert.equal((await confirm.POST(body)).status, 400); disabled = false;
  failQueue = true;
  await assert.rejects(confirm.POST(body));
  assert.equal(tokens.find(t => t.id === active.id).used, false);
  failQueue = false; queries = [];
  const results = await Promise.all([confirm.POST(body), confirm.POST(body)]);
  assert.deepEqual(results.map(r => r.status), [200, 400]);
  assert.equal(events.filter(e => e.event === 'password_changed').length, 1);
  assert.equal(cookieCleared, 1);
  assert.ok(queries.findIndex(q => q.startsWith('SELECT id FROM account_users')) < queries.findIndex(q => q.includes('FROM account_password_reset_tokens') && q.includes('FOR UPDATE')));
  assert.match(queries.find(q => q.startsWith('UPDATE account_users')), /session_version=session_version\+1/);
  limited = true; assert.equal((await request.POST({ identity: 'qa@example.invalid' })).status, 429); limited = false;
  targetAllowed = false; const count = events.length;
  assert.equal((await request.POST({ identity: 'qa@example.invalid' })).status, 200); assert.equal(events.length, count);
  // Flag OFF preserves the legacy direct-send path and random token format.
  targetAllowed = true; env.NOTIFICATIONS_EMAIL_V1_ENABLED = 'false';
  let legacyHash;
  mocks['@/lib/db'].pool.query = async (sql, args) => {
    if (sql.includes('FROM account_users')) return { rows: [{ id: 'account', email: 'qa@example.invalid', username: 'qa' }] };
    if (sql.startsWith('INSERT')) legacyHash = args[1];
    return { rows: [] };
  };
  assert.equal((await request.POST({ identity: 'qa@example.invalid' })).status, 200);
  assert.equal(smtpCalls, 1); assert.match(legacyHash, /^[0-9a-f]{64}$/); assert.equal(events.length, count);
  console.log('VERIFIED offline reset: HMAC/hash-only payload, neutral response, limits, rollback, expiry/reuse, account-first locking, session revocation SQL, atomic change event; PostgreSQL concurrency NOT TESTED');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
