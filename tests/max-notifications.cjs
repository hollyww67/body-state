const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function fixture(env = {}) {
  const calls = [], outgoing = [], adminPending = [];
  const mode = { exports: {}, process: { env } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/max-rollout.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, mode);
  const seen = new Set();
  let owner = true, consumed = true, binding = true, fail = false, http = 200, network = false;
  let contention = false, unlock = true, unlockThrows = false, connectFails = false, acquireThrows = false, fetchHook;
  let held = false, connects = 0;
  let adminVersion = '2026-01-01T00:00:00Z', adminChat = '456';
  const releases = [];
  const query = async (sql, args, session = false) => {
    const config = typeof sql === 'object' ? sql : null;
    if (config) { args = config.values; sql = config.text; }
    calls.push({ sql, args, session, query_timeout: config?.query_timeout });
    if (session) assert.equal(config?.query_timeout,1000);
    if (sql.includes('pg_try_advisory_lock')) {
      assert.equal(session, true);
      if (acquireThrows) { held = true; throw Error('private acquisition error'); }
      held = !contention;
      return { rows: [{ acquired: held }] };
    }
    if (sql.includes('pg_advisory_unlock')) {
      assert.equal(session, true);
      if (unlockThrows) throw Error('private unlock error');
      if (unlock) held = false;
      return { rows: [{ released: unlock }] };
    }
    if (fail) throw new Error('private provider secret');
    if (sql.includes('INSERT INTO max_incoming')) {
      if (seen.has(args[0])) return { rowCount: 0, rows: [] };
      seen.add(args[0]);
    }
    if (sql.includes('SELECT account_user_id FROM max_pairing')) return { rowCount: owner ? 1 : 0, rows: owner ? [{ account_user_id: 'account-one' }] : [] };
    if (sql.includes('DELETE FROM max_pairing') && sql.includes('RETURNING')) return { rowCount: consumed ? 1 : 0, rows: [] };
    if (sql.includes('JOIN account_users')) return { rowCount: binding ? 1 : 0, rows: [] };
    if (sql.includes('FROM max_admin_binding')) return {rowCount:binding&&args[0]===adminChat&&args[1]===adminVersion?1:0,rows:[]};
    return { rowCount: 1, rows: [{ id: 'account-one' }] };
  };
  const context = { exports: {}, Error, Buffer, URL, AbortSignal, process: { env },
    fetch: async (url, options) => {
      outgoing.push({ url, options });
      if (fetchHook) await fetchHook();
      if (network) throw new Error('private provider secret');
      return new Response(JSON.stringify({ message: { body: { mid: 'provider-message' } } }), { status: http });
    },
    require: name => {
      if (name === '@/lib/db') return { db: { transaction: fn => fn({ query }) }, pool: { query,
        connect: async () => {
          connects++;
          if (connectFails) throw Error('private connection error');
          return {query:(sql,args)=>query(sql,args,true),release:destroy=>{releases.push(destroy);if(destroy)held=false;}};
        },
      } };
      if (name === '@/lib/max-admin-binding') return {recordMaxAdminPending:async(...args)=>{adminPending.push(args.slice(1));}};
      if (name === '@/lib/max-rollout') return mode.exports;
      if (name === '@/lib/notification-result') return { providerFailure: status => ({ status: status === 429 ? 'retry' : 'failed', error: 'provider_rejected' }) };
      return require(name);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/max-notifications.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: context.exports, calls, outgoing, adminPending, releases,
    lease:()=>({held,connects}), configure: value => { ({ owner = owner, consumed = consumed, binding = binding, fail = fail, http = http, network = network,
      contention = contention, unlock = unlock, unlockThrows = unlockThrows, connectFails = connectFails, acquireThrows = acquireThrows, fetchHook = fetchHook,
      adminVersion = adminVersion, adminChat = adminChat } = value); } };
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

const adminRecipient = {role:'admin',boundAt:'2026-01-01T00:00:00Z'};
test('admin lease holds one session through HTTP outcome without a transaction or nested borrowing',async()=>{
  const f=fixture(enabled);
  let finishFetch, enteredFetch;
  const entered=new Promise(resolve=>{enteredFetch=resolve;});
  f.configure({fetchHook:()=>{enteredFetch();return new Promise(resolve=>{finishFetch=resolve;});}});
  const sending=f.api.deliverMax('456','synthetic',adminRecipient);
  await entered;
  assert.deepEqual(f.lease(),{held:true,connects:1});
  assert.equal(f.releases.length,0);
  assert(f.calls.every(c=>c.session));
  assert(!f.calls.some(c=>/BEGIN|COMMIT|ROLLBACK/.test(c.sql)));
  assert.match(f.calls[0].sql,/pg_try_advisory_lock\(221022,1\)/);
  assert.match(f.calls[1].sql,/confirmed_at=\$2/);
  assert.equal(f.calls[1].args[1],adminRecipient.boundAt);
  finishFetch();
  assert.equal((await sending).status,'accepted');
  assert.deepEqual(f.releases,[false]);
  assert.equal(f.lease().held,false);
  assert.match(f.calls.at(-1).sql,/pg_advisory_unlock\(221022,1\)/);
});

test('revoked or rebound admin binding and lease contention never admit HTTP',async()=>{
  for(const settings of [{binding:false},{adminVersion:'2026-01-02T00:00:00Z'},{adminChat:'789'},{contention:true}]){
    const f=fixture(enabled);f.configure(settings);
    const result=await f.api.deliverMax('456','synthetic',adminRecipient);
    assert.equal(result.status,settings.contention?'retry':'failed');
    assert.equal(f.outgoing.length,0);
    assert.deepEqual(f.releases,[false]);
    assert.equal(f.lease().held,false);
    if(settings.contention)assert.equal(f.calls.length,1);
  }
});

test('admin failures release leases; unknown unlock destroys session without changing HTTP outcome',async()=>{
  for(const [settings,status,destroy] of [
    [{fail:true},'retry',true], [{network:true},'uncertain',false],
    [{http:503},'uncertain',false], [{http:429},'retry',false], [{http:403},'failed',false],
    [{unlock:false},'accepted',true], [{unlockThrows:true},'accepted',true],
    [{network:true,unlockThrows:true},'uncertain',true], [{acquireThrows:true},'retry',true],
    [{acquireThrows:true,unlockThrows:true},'retry',true], [{fail:true,unlockThrows:true},'retry',true],
  ]){
    const f=fixture(enabled);f.configure(settings);
    const result=await f.api.deliverMax('456','synthetic',adminRecipient);
    assert.equal(result.status,status);
    assert.deepEqual(f.releases,[destroy]);
    assert.equal(f.lease().held,false);
    assert(!JSON.stringify(result).includes('private'));
    assert.equal(f.outgoing.length,settings.fail||settings.acquireThrows?0:1);
  }
  const f=fixture(enabled);f.configure({connectFails:true});
  assert.equal((await f.api.deliverMax('456','synthetic',adminRecipient)).status,'retry');
  assert.equal(f.outgoing.length,0);assert.deepEqual(f.releases,[]);
});

function route(file, mocks, env = {}) {
  const context = { exports: {}, Error, URL, process: {env}, require: name => {
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
    '@/lib/max-notifications': { maxClientsEnabled: () => true,
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

test('admin-only rollout blocks client pairing and delivery even with existing client binding', async () => {
  const f = fixture({ ...enabled, NOTIFICATIONS_MAX_V1_ADMIN_ONLY: 'true' });
  assert.equal(f.api.maxEnabled(), true); assert.equal(f.api.maxClientsEnabled(), false);
  await assert.rejects(f.api.createMaxPairing('account-one'), /MAX_DISABLED/);
  await assert.rejects(f.api.unlinkMax('account-one'), /MAX_DISABLED/);
  assert.equal((await f.api.deliverMax('456', 'client', {role:'client',accountUserId:'account-one',boundAt:'2026-01-01T00:00:00Z'})).status, 'not_configured');
  assert.equal(f.calls.length, 0); assert.equal(f.outgoing.length, 0);
  assert.equal((await f.api.deliverMax('456', 'admin', {role:'admin',boundAt:'2026-01-01T00:00:00Z'})).status, 'accepted');
  assert(f.calls.some(c => c.sql.includes('FROM max_admin_binding')));
  assert(!f.calls.some(c => c.sql.includes('JOIN account_users')));
});

test('admin-only webhook never consumes existing client codes or confirms admin binding', async () => {
  const f = fixture({ ...enabled, NOTIFICATIONS_MAX_V1_ADMIN_ONLY: 'true' });
  const update = f.api.parseMaxUpdate(event());
  assert.equal((await f.api.acceptMaxUpdate(update)).duplicate, false);
  assert.equal((await f.api.acceptMaxUpdate(update)).duplicate, true);
  assert.equal(f.adminPending.length, 1);
  assert(!f.calls.some(c => /max_pairing_codes|max_account_bindings|INSERT INTO max_admin_binding/.test(c.sql)));
  assert.equal(f.outgoing.length, 0);
});

test('invalid admin-only mode fails closed, explicit false preserves full rollout', async () => {
  for (const mode of ['', 'TRUE', '1', 'admin']) {
    const f = fixture({...enabled, NOTIFICATIONS_MAX_V1_ADMIN_ONLY:mode});
    assert.equal(f.api.maxEnabled(), false); assert.equal(f.api.maxClientsEnabled(), false);
    assert.equal((await f.api.deliverMax('456','blocked',{role:'admin',boundAt:'2026-01-01T00:00:00Z'})).status,'not_configured');
    assert.equal(f.calls.length+f.outgoing.length,0);
  }
  assert.equal(fixture({...enabled,NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'false'}).api.maxClientsEnabled(),true);
});

test('admin-only customer pairing routes reject both methods before auth or mutation',async()=>{
  const f=fixture({...enabled,NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'true'});
  const forbidden=()=>{throw Error('customer path must not run');};
  const r=route('account/notifications/max/pair',{
    '@/lib/max-notifications':f.api,'@/lib/account-auth':{getAccountSession:forbidden},
    '@/lib/request':{enforceRateLimit:forbidden},'@/lib/rate-limit':{checkRateLimit:forbidden},
  });
  assert.equal((await r.POST({})).status,503);assert.equal((await r.DELETE({})).status,503);
  assert.equal(f.calls.length+f.outgoing.length,0);
});

test('admin-only account status hides client MAX without changing Email status or binding history',async()=>{
  const f=fixture({...enabled,NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'true'});
  const r=route('account/notifications',{
    '@/lib/account-auth':{getAccountSession:async()=>({userId:'account-one'})},
    '@/lib/db':{pool:{query:async()=>({rows:[{email:'synthetic@example.invalid',max_connected:true}]})}},
    '@/lib/notification-core':{emailV1Enabled:()=>true,maxClientsV1Enabled:f.api.maxClientsEnabled},
    '@/lib/request':{},
  });
  const response=await r.GET({});const body=await response.json();
  assert.equal(body.emailEnabled,true);assert.equal(body.maxEnabled,false);assert.equal(body.maxConnected,true);
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('admin MAX endpoint still requires admin session and same-origin mutations',async()=>{
  let authorized=false,created=0,confirmed=0;
  const f=fixture({...enabled,NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'true'});
  const r=route('admin/notifications/max',{
    '@/lib/max-notifications':f.api,
    '@/lib/admin-auth':{requireAdmin:async()=>authorized?null:Response.json({error:'Unauthorized'},{status:401})},
    '@/lib/request':{enforceRateLimit:async()=>null,readJsonObject:async()=>({maxUserId:'123',maxChatId:'456'})},
    '@/lib/rate-limit':{checkRateLimit:async()=>true},
    '@/lib/max-admin-binding':{getMaxAdminBinding:async()=>({connected:false,pending:null}),createMaxAdminPairing:async()=>{created++;return {code:'synthetic-code'};},confirmMaxAdminBinding:async()=>{confirmed++;return false;},revokeMaxAdminBinding:async()=>{}},
  });
  const request=origin=>({headers:new Headers({origin}),nextUrl:new URL('https://example.invalid/api/admin/notifications/max')});
  assert.equal((await r.GET(request('https://example.invalid'))).status,401);
  authorized=true;
  assert.equal((await r.POST(request('https://forged.invalid'))).status,403);assert.equal(created,0);
  assert.equal((await r.GET(request('https://example.invalid'))).status,200);assert.equal(confirmed,0);
  assert.equal((await r.POST(request('https://example.invalid'))).status,200);assert.equal(created,1);assert.equal(confirmed,0);
});

test('admin mutations use canonical public origin behind reverse proxy, never forwarded host',async()=>{
  let authorized=true,limited=false,globalLimited=false,on=true;
  const mutations=[];
  const mocks={
    '@/lib/max-notifications':{maxEnabled:()=>on},
    '@/lib/admin-auth':{requireAdmin:async()=>authorized?null:Response.json({error:'Unauthorized'},{status:401})},
    '@/lib/request':{enforceRateLimit:async()=>limited?Response.json({}, {status:429}):null,readJsonObject:async()=>({maxUserId:'123',maxChatId:'456'})},
    '@/lib/rate-limit':{checkRateLimit:async()=>!globalLimited},
    '@/lib/max-admin-binding':{
      getMaxAdminBinding:async()=>({connected:false,pending:null}),
      createMaxAdminPairing:async()=>{mutations.push('POST');return {code:'synthetic-code'};},
      confirmMaxAdminBinding:async()=>{mutations.push('PATCH');return false;},
      revokeMaxAdminBinding:async()=>{mutations.push('DELETE');},
    },
  };
  const load=env=>route('admin/notifications/max',mocks,env);
  const r=load({NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'https://body-state.ru'});
  const req=(origin='https://body-state.ru',extra={})=>({headers:new Headers({...origin===null?{}:{origin},...extra}),nextUrl:new URL('https://0.0.0.0:3000/api/admin/notifications/max')});
  for(const method of ['POST','PATCH','DELETE']){
    authorized=false;
    assert.equal((await r[method](req())).status,401);
    authorized=true;
    for(const origin of [null,'','null','https://0.0.0.0:3000','http://body-state.ru','https://body-state.ru:444','https://sub.body-state.ru','https://body-state.ru.evil.invalid','https://body-state.ru/','https://user@body-state.ru','https://body-state.ru, https://evil.invalid']){
      const before=mutations.length;
      assert.equal((await r[method](req(origin,{host:'body-state.ru','x-forwarded-host':'body-state.ru','x-forwarded-proto':'https',forwarded:'host=body-state.ru;proto=https'}))).status,403);
      assert.equal(mutations.length,before);
    }
    const before=mutations.length;
    assert.equal((await r[method](req(undefined,{'sec-fetch-site':'cross-site'}))).status,403);
    assert.equal(mutations.length,before);
    limited=true;assert.equal((await r[method](req())).status,429);limited=false;
    globalLimited=true;assert.equal((await r[method](req())).status,429);globalLimited=false;
    assert.equal(mutations.length,before);
    const good=await r[method](req(undefined,{'x-forwarded-host':'evil.invalid'}));
    assert.equal(good.status,method==='PATCH'?409:200);
    assert.equal(good.headers.get('cache-control'),'no-store');
    assert.equal(mutations.length,before+1);assert.equal(mutations.at(-1),method);
  }
  for(const site of [undefined,'','not-a-url','http://body-state.ru','https://user:pass@body-state.ru','https://body-state.ru/path','https://body-state.ru?query=1','https://body-state.ru#fragment']){
    const bad=load({NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:site});
    const before=mutations.length;
    assert.equal((await bad.POST(req())).status,503);assert.equal(mutations.length,before);
    assert.equal((await bad.GET(req())).status,200);
  }
  on=false;
  for(const method of ['GET','POST','PATCH','DELETE'])assert.equal((await r[method](req())).status,503);
});
