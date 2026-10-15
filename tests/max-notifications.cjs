const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function fixture(env = {}) {
  const calls = [], outgoing = [];
  const seen = new Set();
  let owner = true, consumed = true, binding = true, fail = false, http = 200, network = false;
  const query = async (sql, args) => {
    calls.push({ sql, args });
    if (fail) throw new Error('private provider secret');
    if (sql.includes('INSERT INTO max_incoming')) {
      if (seen.has(args[0])) return { rowCount: 0, rows: [] };
      seen.add(args[0]);
    }
    if (sql.includes('SELECT account_user_id FROM max_pairing')) return { rowCount: owner ? 1 : 0, rows: owner ? [{ account_user_id: 'account-one' }] : [] };
    if (sql.includes('DELETE FROM max_pairing') && sql.includes('RETURNING')) return { rowCount: consumed ? 1 : 0, rows: [] };
    if (sql.includes('JOIN account_users')) return { rowCount: binding ? 1 : 0, rows: [] };
    if (sql.includes('FROM max_admin_binding')) return {rowCount:binding?1:0,rows:[]};
    return { rowCount: 1, rows: [{ id: 'account-one' }] };
  };
  const context = { exports: {}, Error, Buffer, URL, AbortSignal, process: { env },
    fetch: async (url, options) => {
      outgoing.push({ url, options });
      if (network) throw new Error('private provider secret');
      return new Response(JSON.stringify({ message: { body: { mid: 'provider-message' } } }), { status: http });
    },
    require: name => {
      if (name === '@/lib/db') return { db: { transaction: fn => fn({ query }) }, pool: { query } };
      if (name === '@/lib/max-admin-binding') return {recordMaxAdminPending:async()=>{}};
      if (name === '@/lib/notification-result') return { providerFailure: status => ({ status: status === 429 ? 'retry' : 'failed', error: 'provider_rejected' }) };
      return require(name);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/max-notifications.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: context.exports, calls, outgoing, configure: value => { ({ owner = owner, consumed = consumed, binding = binding, fail = fail, http = http, network = network } = value); } };
}
const enabled = { NOTIFICATIONS_MAX_V1_ENABLED: 'true', MAX_BOT_TOKEN: 'fake-token', MAX_WEBHOOK_SECRET: 's'.repeat(40), MAX_BOT_URL: 'https://max.ru/body_state_bot' };
function event(text = 'a'.repeat(43)) {
  return { update_type: 'message_created', timestamp: Date.now(), message: {
    sender: { user_id: 123, is_bot: false }, recipient: { chat_id: 456, chat_type: 'dialog' }, body: { mid: 'mid-1', text } } };
}
test('strict flag off never queries DB or calls provider', async () => {
  for (const flag of [undefined, 'false', '1', 'TRUE']) {
    const f = fixture({ ...enabled, NOTIFICATIONS_MAX_V1_ENABLED: flag });
    assert.equal((await f.api.deliverMax('456', 'hello')).status, 'not_configured');
    await assert.rejects(f.api.createMaxPairing('account-one'));
    await assert.rejects(f.api.unlinkMax('account-one'));
    assert.equal(f.calls.length + f.outgoing.length, 0);
  }
});
test('secret fails closed and compares hashes', () => {
  const f = fixture(enabled);
  assert.equal(f.api.validMaxSecret(enabled.MAX_WEBHOOK_SECRET), true);
  for (const secret of [null, '', 'wrong', 's'.repeat(300)]) assert.equal(f.api.validMaxSecret(secret), false);
  assert.equal(fixture().api.validMaxSecret('x'), false);
});
test('pair is opaque hashed short TTL and official bot URL', async () => {
  const f = fixture(enabled), pair = await f.api.createMaxPairing('account-one');
  assert.match(pair.code, /^[\w-]{43}$/);
  assert.ok(Date.parse(pair.expiresAt) - Date.now() <= 300000);
  const insert = f.calls.find(c => c.sql.includes('INSERT INTO max_pairing'));
  assert.equal(insert.args[1], f.api.maxHash(pair.code));
  assert.ok(!JSON.stringify(f.calls).includes(pair.code));
  await assert.rejects(fixture({ ...enabled, MAX_BOT_URL: 'https://evil.invalid/bot' }).api.createMaxPairing('account-one'));
});
test('private human messages only, bounded schema and stable dedup key', () => {
  const f = fixture(enabled), original = event();
  const first = f.api.parseMaxUpdate(original);
  assert.equal(f.api.parseMaxUpdate({ ...original, timestamp: original.timestamp + 1 }).key, first.key);
  for (const mutate of [e => e.message.recipient.chat_type = 'chat', e => e.message.sender.is_bot = true,
    e => e.message.sender.user_id = Number.MAX_SAFE_INTEGER + 1, e => e.message.body.text = 'a'.repeat(4097),
    e => e.timestamp += 120000, e => e.update_type = 'bot_started']) {
    const e = event(); mutate(e); assert.throws(() => f.api.parseMaxUpdate(e));
  }
});
test('durable duplicate returns before a second pairing mutation; no raw code persisted', async () => {
  const f = fixture(enabled), update = f.api.parseMaxUpdate(event());
  assert.equal((await f.api.acceptMaxUpdate(update)).duplicate, false);
  assert.equal((await f.api.acceptMaxUpdate(update)).duplicate, true);
  assert.equal(f.calls.filter(c => c.sql.includes('INSERT INTO max_account_bindings')).length, 1);
  assert.ok(!JSON.stringify(f.calls).includes(update.code));
  assert.ok(f.calls.some(c => c.sql.includes('created_at<=to_timestamp')));
});
test('expired/used/unknown codes cannot bind', async () => {
  for (const settings of [{ owner: false }, { consumed: false }]) {
    const f = fixture(enabled); f.configure(settings);
    await f.api.acceptMaxUpdate(f.api.parseMaxUpdate(event()));
    assert.equal(f.calls.filter(c => c.sql.includes('INSERT INTO max_account_bindings')).length, 0);
  }
});
test('unlink revokes pending pairing and active identity under account lock', async () => {
  const f = fixture(enabled); await f.api.unlinkMax('account-one');
  assert.match(f.calls[0].sql, /FOR UPDATE/);
  assert.ok(f.calls.some(c => c.sql.startsWith('DELETE FROM max_pairing_codes')));
  assert.ok(f.calls.some(c => c.sql.startsWith('DELETE FROM max_account_bindings')));
});
test('stream body ceiling works without content length', async () => {
  const f = fixture(enabled);
  await assert.rejects(f.api.readMaxUpdate(new Request('https://example.invalid', { method: 'POST', body: 'x'.repeat(65537) })), /MAX_TOO_LARGE/);
  assert.equal((await f.api.readMaxUpdate(new Response('{"ok":true}'))).ok, true);
});
test('provider fixed host, headers, timeout and acceptance; no real network', async () => {
  const f = fixture(enabled), result = await f.api.deliverMax('456', 'hello',{role:'client',accountUserId:'account-one',boundAt:'2026-01-01T00:00:00Z'});
  assert.equal(result.status, 'accepted'); assert.equal(result.id, 'provider-message');
  assert.equal(f.outgoing[0].url, 'https://platform-api2.max.ru/messages?chat_id=456');
  assert.equal(f.outgoing[0].options.headers.Authorization, 'fake-token');
  assert.equal(f.outgoing[0].options.redirect, 'error');
  assert.ok(f.outgoing[0].options.signal);
});
test('provider ambiguity, rejection, rate limit, unlink and DB failure classified safely', async () => {
  for (const [settings, expected] of [[{ http: 429 }, 'retry'], [{ http: 403 }, 'failed'], [{ http: 503 }, 'uncertain'],
    [{ network: true }, 'uncertain'], [{ binding: false }, 'failed'], [{ fail: true }, 'retry']]) {
    const f = fixture(enabled); f.configure(settings);
    const result = await f.api.deliverMax('456', 'hello',{role:'client',accountUserId:'account-one',boundAt:'2026-01-01T00:00:00Z'});
    assert.equal(result.status, expected); assert.ok(!JSON.stringify(result).includes('private'));
    if (settings.binding === false || settings.fail) assert.equal(f.outgoing.length, 0);
  }
});
test('MAX transport requires expected owner/version and separates admin from customer lookup',async()=>{
  const f=fixture(enabled);
  assert.equal((await f.api.deliverMax('456','hello')).status,'failed');assert.equal(f.outgoing.length,0);
  await f.api.deliverMax('456','hello',{role:'admin',boundAt:'2026-01-01T00:00:00Z'});
  assert(f.calls.some(c=>c.sql.includes('FROM max_admin_binding')&&c.args[1]==='2026-01-01T00:00:00Z'));
  assert(!f.calls.some(c=>c.sql.includes('JOIN account_users')));
  f.configure({binding:false});
  assert.equal((await f.api.deliverMax('456','hello',{role:'admin',boundAt:'2026-01-01T00:00:00Z'})).status,'failed');
  assert.equal(f.outgoing.length,1);
});

function route(file, mocks) {
  const context = { exports: {}, Error, require: name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api', file, 'route.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
test('webhook rejects forged and oversized updates; 200 only after durable success', async () => {
  const f = fixture(enabled);
  let commits = 0, failing = false;
  const r = route('integrations/max/webhook', { '@/lib/max-notifications': { ...f.api,
    acceptMaxUpdate: async () => { if (failing) throw new Error('db failed'); commits++; },
  } });
  const request = (secret, body = JSON.stringify(event())) => new Request('https://example.invalid', {
    method: 'POST', headers: { 'x-max-bot-api-secret': secret }, body,
  });
  assert.equal((await r.POST(request('forged'))).status, 401); assert.equal(commits, 0);
  assert.equal((await r.POST(request(enabled.MAX_WEBHOOK_SECRET, 'x'.repeat(65537)))).status, 413);
  assert.equal((await r.POST(request(enabled.MAX_WEBHOOK_SECRET))).status, 200); assert.equal(commits, 1);
  failing = true;
  assert.equal((await r.POST(request(enabled.MAX_WEBHOOK_SECRET))).status, 503);
});
test('pair routes enforce origin and account auth, never admin identity; response is no-store', async () => {
  let authenticated = false, limited = false, mutations = 0;
  const r = route('account/notifications/max/pair', {
    '@/lib/account-auth': { getAccountSession: async () => authenticated ? { userId: 'account-one' } : null },
    '@/lib/request': { enforceRateLimit: async () => null },
    '@/lib/rate-limit': { checkRateLimit: async () => !limited },
    '@/lib/max-notifications': { maxEnabled: () => true,
      createMaxPairing: async user => { assert.equal(user, 'account-one'); mutations++; return { code: 'opaque', expiresAt: 'later', botUrl: 'https://max.ru/bot' }; },
      unlinkMax: async user => { assert.equal(user, 'account-one'); mutations++; },
    },
  });
  const req = origin => ({ headers: new Headers({ origin }), nextUrl: new URL('https://example.invalid/api/account/notifications/max/pair') });
  assert.equal((await r.POST(req('https://forged.invalid'))).status, 403);
  assert.equal((await r.POST(req('https://example.invalid'))).status, 401);
  authenticated = true; limited = true;
  assert.equal((await r.POST(req('https://example.invalid'))).status, 429); assert.equal(mutations, 0);
  limited = false;
  const response = await r.POST(req('https://example.invalid'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(await response.json()).sort(), ['botUrl', 'code', 'expiresAt']);
  assert.equal((await r.DELETE(req('https://example.invalid'))).status, 200); assert.equal(mutations, 2);
});
