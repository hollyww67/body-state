const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const { spawnSync } = require('node:child_process');
const database = process.env.AUDIT_DATABASE_NAME;
const url = new URL(process.env.DATABASE_URL);
if (!/^audit_regression_[0-9]+$/.test(database || '') || url.hostname !== '127.0.0.1' || url.port !== '15432' || url.pathname !== `/${database}`) throw new Error('Only a new isolated local audit database is allowed');
if (process.env.POSTGRES_POOL_SIZE !== '10') throw new Error('This regression must use pool=10');
global.fetch = async () => { throw new Error('No external traffic'); };
for (const protocol of ['node:http', 'node:https']) require(protocol).request = () => { throw new Error('No provider traffic'); };
const migrate = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/migrate.mjs')], { env: process.env, stdio: 'inherit' });
assert.equal(migrate.status, 0);
const originalLoad = Module._load;
const mocks = {
  '@/lib/account-auth': { getAccountSession: async () => null },
  '@/lib/redis': { getRedis:async()=>({eval:async()=>1}),cacheIncrement: async () => 1, cacheDelete: async () => undefined },
  '@/lib/telegram': { sendTelegram: async () => true },
  '@/lib/push': { sendPushToAdmin: async () => true },
};
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  if (request.startsWith('.') && parent?.filename) {
    const resolved = path.resolve(path.dirname(parent.filename),request).replace(/\.js$/,'');
    for (const [alias,value] of Object.entries(mocks)) if (resolved === path.resolve(__dirname,'../src',alias.slice(2))) return value;
  }
  if (request === 'next/server') return {
    ...originalLoad.call(this, 'next/dist/server/web/spec-extension/request', parent, isMain),
    ...originalLoad.call(this, 'next/dist/server/web/spec-extension/response', parent, isMain),
  };
  if (request.startsWith('@/')) request = path.resolve(__dirname, '../src', request.slice(2)) + '.js';
  return originalLoad.call(this, request, parent, isMain);
};
const { db, pool } = require('../src/lib/db.js');
const slots = require('../src/lib/slots.js');
const journey = require('../src/lib/booking-journey.js');
const prices = require('../src/lib/service-prices.js');
const promos = require('../src/lib/promo-codes.js');
const { updateAdminBooking } = require('../src/lib/admin-bookings.js');
const { NextRequest } = require('next/server');
const apis = Object.fromEntries(['bfm','brt','psychology'].map(service => [service, require(`../src/app/api/book/${service}/route.js`)]));
// Fail on any nested pool checkout, even if a price fallback catches the error.
// Queries on the supplied PoolClient do not go through pool.query/connect.
const transactionContext = new AsyncLocalStorage();
let nestedCheckouts = 0;
const connect = pool.connect.bind(pool);
pool.connect = function(...args) {
  if (transactionContext.getStore()) { nestedCheckouts++; throw new Error('Nested pool checkout in transaction'); }
  return connect(...args);
};
const transaction = db.transaction.bind(db);
db.transaction = callback => transaction(client => transactionContext.run(true, () => callback(client)));
const results = [];
let dateIndex = 0;
async function test(name, run) {
  const started = performance.now();
  await run();
  assert.equal(nestedCheckouts, 0);
  assert.equal(pool.waitingCount, 0);
  results.push({ name, ms: Math.round(performance.now() - started) });
  console.log('PASS', JSON.stringify(results.at(-1)));
}
function nextDate() { return new Date(Date.UTC(2102, 0, 1 + dateIndex++, 6, 30)).toISOString(); }
async function slot(service = 'bfm', time = nextDate()) {
  return (await pool.query('INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES($1,$2,90) RETURNING id::text', [service,time])).rows[0].id;
}
function fields(extra = {}) { return { client_name:'Pool QA',client_phone:'+79990000001',client_email:'pool@example.invalid',status:'pending',payment_status:'pending',payment_option:'online',...extra }; }
function assertOne(attempts) {
  assert.equal(attempts.filter(r => r.ok).length, 1);
  assert(attempts.filter(r => !r.ok).every(r => r.status === 409), JSON.stringify(attempts.filter(r => !r.ok)));
}
async function apiClaim(service, id, extra = {}) {
  const response = await apis[service].POST(new NextRequest(`http://localhost/api/book/${service}`, {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slot_id:id,client_name:'Pool QA',client_phone:'+79990000001',client_email:'pool@example.invalid',consent:true,...extra}),
  }));
  return { status:response.status, body:await response.json() };
}
async function assertNoOverlaps() {
  const active = ['bfm','brt','psychology'].map(s => `SELECT b.id,s.slot_time,s.duration_minutes FROM ${s}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.status NOT IN ('cancelled','completed')`).join(' UNION ALL ');
  const conflicts = await pool.query(`WITH active AS (${active}) SELECT count(*)::int n FROM active a JOIN active b ON a.id::text<b.id::text AND tstzrange(a.slot_time,a.slot_time+a.duration_minutes*interval '1 minute','[)') && tstzrange(b.slot_time,b.slot_time+b.duration_minutes*interval '1 minute','[)')`);
  assert.equal(conflicts.rows[0].n,0);
}
(async () => {
  assert.equal(pool.options.max,10);
  assert.equal((await pool.query('SELECT current_database() name')).rows[0].name,database);
  const program = (await pool.query("INSERT INTO psychology_programs(title,slug,price) VALUES('Pool QA program','pool-qa',4200) RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO promo_codes(code,discount_type,discount_value,service_codes) VALUES('QA-POOL10','percent',10,ARRAY['bfm','brt','psychology','psychology_program'])");
  for (const count of [10,20,30]) {
    await test(`${count} parallel API claims, pool10, exactly one 201 and remaining 409`,async () => {
      const id = await slot();
      const attempts = await Promise.all(Array.from({length:count}, () => apiClaim('bfm',id,{promoCode:'QA-POOL10'})));
      assert.equal(attempts.filter(r => r.status===201).length,1);
      assert(attempts.filter(r => r.status!==201).every(r => r.status===409));
      const bookings = (await pool.query('SELECT journey_snapshot FROM bfm_bookings WHERE slot_id=$1',[id])).rows;
      assert.equal(bookings.length,1); assert.equal(bookings[0].journey_snapshot.discount,bookings[0].journey_snapshot.subtotal*0.1);
    });
  }
  await test('30 mixed-service API claims for overlapping interval including program and promo',async () => {
    const time = nextDate();
    const ids = await Promise.all(['bfm','brt','psychology'].map(service => slot(service,time)));
    const attempts = await Promise.all(Array.from({length:30},(_,i) => apiClaim(['bfm','brt','psychology'][i%3],ids[i%3],{promoCode:'QA-POOL10',...(i%3===2 ? {program_id:program,booking_type:'online'} : {})})));
    assert.equal(attempts.filter(r => r.status===201).length,1);
    assert(attempts.filter(r => r.status!==201).every(r => r.status===409));
    await assertNoOverlaps();
  });
  await test('30 distinct successful program claims and concurrent legacy price/promo reads',async () => {
    const ids = await Promise.all(Array.from({length:30},() => slot('psychology')));
    const attempts = await Promise.all([
      ...ids.map(id => slots.claimSlot(id,'psychology',fields({program_id:program,booking_type:'online',journey_promo_code:'QA-POOL10'}))),
      ...Array.from({length:30},() => prices.getServicePrice('psychology')),
      ...Array.from({length:30},() => promos.validatePromoCode('QA-POOL10','psychology_program',4200)),
    ]);
    assert(attempts.slice(0,30).every(r => r.ok));
    assert(attempts.slice(0,30).every(r => r.booking.summary.snapshot.subtotal===4200 && r.booking.summary.snapshot.total===3780));
    assert(attempts.slice(30,60).every(r => r.code==='psychology' && r.price>0));
    const saved = (await pool.query('SELECT count(*)::int n FROM psychology_bookings WHERE slot_id=ANY($1::uuid[])',[ids])).rows[0].n;
    assert.equal(saved,30);
    assert(attempts.slice(60).every(r => r.total===3780));
    const legacy=await journey.createJourneySnapshot('psychology',{program_id:program,journey_promo_code:'QA-POOL10'},90);
    assert.equal(legacy.total,3780);
  });
  await test('30 identical idempotency requests reuse one booking and notifications',async () => {
    const id = await slot(); const access = journey.createBookingAccess();
    const input = fields({journey_request_key:crypto.randomUUID(),journey_access_token:access.token,journey_promo_code:'QA-POOL10'});
    const attempts = await Promise.all(Array.from({length:30},() => slots.claimSlot(id,'bfm',input)));
    assert(attempts.every(r => r.ok)); assert.equal(attempts.filter(r => r.created).length,1);
    assert.equal(new Set(attempts.map(r => r.booking.id)).size,1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1',[attempts[0].booking.id])).rows[0].n,2);
    const forbidden = await slots.claimSlot(id,'bfm',{...input,journey_access_token:journey.createBookingAccess().token});
    assert.equal(forbidden.status,409);
  });
  await test('claims compete with reschedule, cancellation and breaks at pool10',async () => {
    for (let iteration=0;iteration<5;iteration++) {
      const original = await slots.claimSlot(await slot(),'bfm',fields()); assert(original.ok);
      const target = await slot();
      const [moved,...claims] = await Promise.all([
        slots.rescheduleBooking({bookingId:original.booking.id,serviceType:'bfm',newSlotId:target}),
        ...Array.from({length:20},() => slots.claimSlot(target,'bfm',fields())),
      ]);
      assertOne([moved,...claims]);
      const cancelled = await slots.claimSlot(await slot(),'bfm',fields()); assert(cancelled.ok);
      const [cancel,...replacement] = await Promise.all([
        slots.cancelAccountBooking(cancelled.booking.id,'bfm',undefined),
        ...Array.from({length:20},() => slots.claimSlot(cancelled.slot.id,'bfm',fields())),
      ]);
      assert(cancel.ok); assertOne(replacement);
      assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1',[cancelled.booking.id])).rows[0].status,'cancelled');
      const time=nextDate(); const blocked=await slot('psychology',time);
      const [pause,...appointments] = await Promise.all([
        slots.createScheduleBreak({startsAt:time,endsAt:new Date(new Date(time).getTime()+90*60000).toISOString(),reason:'Pool QA'}),
        ...Array.from({length:20},() => slots.claimSlot(blocked,'psychology',fields({booking_type:'offline',program_id:program,journey_promo_code:'QA-POOL10'}))),
      ]);
      assertOne([pause,...appointments]);
    }
    await assertNoOverlaps();
  });
  await test('invalid promo and insert failure fully roll back occupancy and notifications under load',async () => {
    const invalidIds = await Promise.all(Array.from({length:20},() => slot()));
    const rejected = await Promise.all(invalidIds.map(id => slots.claimSlot(id,'bfm',fields({journey_promo_code:'QA-MISSING'}))));
    assert(rejected.every(r => !r.ok && r.status===400));
    const failingIds = await Promise.all(Array.from({length:20},() => slot()));
    const failed = await Promise.all(failingIds.map(id => slots.claimSlot(id,'bfm',fields({account_user_id:'00000000-0000-0000-0000-000000000001'}))));
    assert(failed.every(r => !r.ok && r.status===500)); // expected injected FK failures, not pool timeouts
    const ids=[...invalidIds,...failingIds];
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=ANY($1::uuid[]) AND is_booked',[ids])).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM bfm_bookings WHERE slot_id=ANY($1::uuid[])',[ids])).rows[0].n,0);
  });
  await test('other scheduling helpers reuse the transaction client',async () => {
    await slots.refreshScheduleOccupancy();
    const id=await slot(); const visit=await slots.claimSlot(id,'bfm',fields()); assert(visit.ok);
    assert((await slots.cancelUnpaidHold(visit.booking.id,'bfm','+79990000001')).ok);
    await slots.releaseSlotTime(id);
    const adminVisit=await slots.claimSlot(await slot(),'bfm',fields()); assert(adminVisit.ok);
    await updateAdminBooking(adminVisit.booking.id,'cancelled');
    const start=nextDate();
    const pause=await slots.createScheduleBreak({startsAt:start,endsAt:new Date(new Date(start).getTime()+60*60000).toISOString(),reason:'Pool helper QA'}); assert(pause.ok);
    assert((await slots.deleteScheduleBreak(pause.scheduleBreak.id)).ok);
    await require('../src/lib/appointment-notifications.js').syncReminders();
  });
  await assertNoOverlaps();
  const orphaned=await pool.query(`SELECT count(*)::int n FROM appointment_notifications notification WHERE NOT EXISTS (
    SELECT 1 FROM bfm_bookings b WHERE notification.service_type='bfm' AND b.id=notification.booking_id
    UNION ALL SELECT 1 FROM brt_bookings b WHERE notification.service_type='brt' AND b.id=notification.booking_id
    UNION ALL SELECT 1 FROM psychology_bookings b WHERE notification.service_type='psychology' AND b.id=notification.booking_id)`);
  assert.equal(orphaned.rows[0].n,0);
  assert.equal(nestedCheckouts,0); assert.equal(pool.waitingCount,0);
  console.log(JSON.stringify({passed:results.length,pool:pool.options.max,nestedCheckouts,results}));
})().catch(error => { console.error(error);process.exitCode=1; }).finally(() => pool.end());
