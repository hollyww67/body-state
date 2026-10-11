const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
// No live provider traffic, even if an integration forgets its fixture.
global.fetch = async () => { throw new Error('External network disabled in integration tests'); };
for (const protocol of ['node:http', 'node:https']) {
  require(protocol).request = () => { throw new Error('HTTP transport disabled in integration tests; install an explicit provider fixture'); };
}

// This suite runs exclusively in a newly created, isolated database.
const database = process.env.AUDIT_DATABASE_NAME;
if (!/^audit_regression_[0-9]+$/.test(database || '')) throw new Error('Set an isolated AUDIT_DATABASE_NAME');
const databaseUrl = new URL(process.env.DATABASE_URL);
if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!=='15432')throw new Error('Tests require the isolated local PostgreSQL container on port 15432');
databaseUrl.pathname = `/${database}`;
process.env.DATABASE_URL = databaseUrl.toString();
process.env.TINKOFF_TERMINAL_KEY = 'audit-terminal';
process.env.TINKOFF_PASSWORD = 'audit-test-only-password';
const migrate = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/migrate.mjs')], { env: process.env, stdio: 'inherit' });
if (migrate.status !== 0) throw new Error('Test migrations failed');

let sessionUser;
let adminAllowed=true;
let adminPushAttempts=0;
const mocks = {
  '@/lib/tbank-transport': {
    paymentId: value => { if (value == null) throw new Error('Missing payment id'); return String(value); },
    paymentErrorCode: () => 'MOCK_PROVIDER_ERROR',
    requestTbank: async (url, payload) => {
      const response = await global.fetch(url, { method: 'POST', body: JSON.stringify(payload) });
      return { ok: response.ok, data: await response.json() };
    },
  },
  '@/lib/account-auth': { getAccountSession: async () => sessionUser ? { userId: sessionUser } : null },
  '@/lib/admin-auth': { requireAdmin: async () => adminAllowed ? null : new Response(null,{status:401}) },
  '@/lib/cron-auth': { requireCronSecret: () => null },
  '@/lib/telegram': { sendTelegram: async () => true },
  '@/lib/push': { sendPushToAdmin:async()=>{adminPushAttempts++;throw new Error('Synthetic push failure');} },
  '@/lib/notifications': { sendEmail: async () => true, deliverEmail: async () => ({ status: 'not_configured' }) },
  '@/lib/redis': { cacheGet: async () => null, cacheSet: async () => undefined, cacheDelete: async () => undefined, cacheIncrement: async () => 1 },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'next/server') return {
    ...originalLoad.call(this, 'next/dist/server/web/spec-extension/request', parent, isMain),
    ...originalLoad.call(this, 'next/dist/server/web/spec-extension/response', parent, isMain),
  };
  if (mocks[request]) return mocks[request];
  if (request.startsWith('.') && parent?.filename) {
    const resolved = path.resolve(path.dirname(parent.filename), request).replace(/\.js$/, '');
    for (const [alias, value] of Object.entries(mocks)) {
      if (resolved === path.resolve(__dirname, '../src', alias.slice(2))) return value;
    }
  }
  if (request.startsWith('@/')) request = path.resolve(__dirname, '../src', request.slice(2)) + '.js';
  return originalLoad.call(this, request, parent, isMain);
};
const { pool } = require('../src/lib/db.js');
const { NextRequest } = require('next/server');
const { claimSlot, refreshScheduleOccupancy, rescheduleBooking, createScheduleBreak, cancelUnpaidHold } = require('../src/lib/slots.js');
const { updateAdminBooking } = require('../src/lib/admin-bookings.js');
const callback = require('../src/app/api/payment/callback/route.js');
const { generateToken } = require('../src/lib/tbank.js');
const { createPendingOrderWithReservation, transitionOrderState } = require('../src/lib/order-stock.js');
const { recordSuccessfulVisit, syncLoyaltyRewards } = require('../src/lib/loyalty.js');
const { settleBookingPayments } = require('../src/lib/booking-payments.js');
const account = require('../src/app/api/account/route.js');
const complete = require('../src/app/api/cron/auto-complete/route.js');
const promotions = require('../src/app/api/admin/promotions/route.js');
const adminOrders = require('../src/app/api/admin/orders/route.js');
const results = [];
async function test(name, run) { await run(); results.push(name); console.log('PASS', name); }
const request = (url, body, method = 'PATCH') => new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fields = (user = null) => ({ client_name: 'Test client', client_phone: '+79990000001', client_email: 'test@example.invalid', status: 'pending', payment_option: 'online', payment_status: 'pending', account_user_id: user });
async function slot(time, service = 'bfm') {
  return (await pool.query("INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES($1,$2,90) RETURNING id::text", [service,time])).rows[0].id;
}
const baseOrder = () => ({ external_order_id: crypto.randomUUID(), client_name: 'Test', client_phone: '+79990000001', address: 'Test', total: 1000 });

(async () => {
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, database);
  const users = await pool.query("INSERT INTO account_users(username,email,display_name,consent_version,consent_at,verified_at) VALUES('audit-a@example.invalid','audit-a@example.invalid','Test A','audit',now(),now()),('audit-b@example.invalid','audit-b@example.invalid','Test B','audit',now(),now()) RETURNING id::text");
  const [a,b] = users.rows.map(row => row.id);
  sessionUser = a;
  let booked, order;
  await test('parallel 90-minute appointments across services cannot overlap', async () => {
    const first = await slot('2099-01-10T09:30:00+03:00');
    const second = await slot('2099-01-10T10:00:00+03:00','psychology');
    const attempts = await Promise.all([claimSlot(first,'bfm',fields(a)), claimSlot(second,'psychology',{...fields(a),booking_type:'offline'})]);
    assert.equal(attempts.filter(value => value.ok).length,1);
    booked = attempts.find(value => value.ok);
    booked.service = booked.slot.service_type;
    await refreshScheduleOccupancy();
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM slots WHERE id=ANY($1::uuid[]) AND is_booked=true',[[first,second]])).rows[0].count,2);
  });
  await test('failed booking insert rolls back all slot claims', async () => {
    const id=await slot('2099-01-11T09:30:00+03:00');
    const failed=await claimSlot(id,'bfm',{...fields(),account_user_id:'00000000-0000-0000-0000-000000000001'});
    assert.equal(failed.ok,false);
    assert.equal((await pool.query('SELECT is_booked FROM slots WHERE id=$1',[id])).rows[0].is_booked,false);
  });
  await test('duplicate concurrent payment initialization creates one payable order', async () => {
    const items=[{bookingId:booked.booking.id,bookingType:booked.service,name:'Test',price:1000,quantity:1}];
    const attempts=await Promise.allSettled([createPendingOrderWithReservation(baseOrder(),items),createPendingOrderWithReservation(baseOrder(),items)]);
    assert.equal(attempts.filter(value=>value.status==='fulfilled').length,1);
    order=attempts.find(value=>value.status==='fulfilled').value;
  });
  await test('payment reconciles an already confirmed appointment without duplicating it', async () => {
    await pool.query(`UPDATE ${booked.service}_bookings SET status='confirmed' WHERE id=$1`,[booked.booking.id]);
    await settleBookingPayments(order.items,'paid');
    await settleBookingPayments(order.items,'paid');
    const row=(await pool.query(`SELECT status,payment_status FROM ${booked.service}_bookings WHERE id=$1`,[booked.booking.id])).rows[0];
    assert.deepEqual(row,{status:'confirmed',payment_status:'paid'});
  });
  await test('late payment records money without resurrecting a cancelled booking', async () => {
    await pool.query(`UPDATE ${booked.service}_bookings SET status='cancelled',payment_status='pending' WHERE id=$1`,[booked.booking.id]);
    await settleBookingPayments(order.items,'paid');
    const row=(await pool.query(`SELECT status,payment_status FROM ${booked.service}_bookings WHERE id=$1`,[booked.booking.id])).rows[0];
    assert.deepEqual(row,{status:'cancelled',payment_status:'paid'});
  });
  await test('cancelling an inventory order releases stock exactly once', async () => {
    const product=(await pool.query("INSERT INTO products(name,slug,price,stock) VALUES('Test','audit-stock',1000,3) RETURNING id::text")).rows[0];
    const purchase=await createPendingOrderWithReservation(baseOrder(),[{productId:product.id,quantity:2,price:1000}]);
    await Promise.all([transitionOrderState(purchase.id,'cancelled',{allowedFrom:['pending'],releaseStock:true}),transitionOrderState(purchase.id,'cancelled',{allowedFrom:['pending'],releaseStock:true})]);
    assert.equal((await pool.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,3);
  });
  await test('editing contact data cannot claim another account or guest history', async () => {
    const other=await claimSlot(await slot('2099-01-12T09:30:00+03:00'),'bfm',fields(b));
    const guest=await claimSlot(await slot('2099-01-13T09:30:00+03:00'),'bfm',fields());
    const response=await account.PATCH(request('/api/account',{display_name:'Test A',email:'audit-a@example.invalid',phone:'+79990000001',address:''}));
    assert.equal(response.status,200);
    const profile=await (await account.GET(new NextRequest('http://localhost/api/account'))).json();
    assert(!profile.bookings.some(item=>[other.booking.id,guest.booking.id].includes(item.id)));
    assert.equal((await pool.query('SELECT account_user_id FROM bfm_bookings WHERE id=$1',[guest.booking.id])).rows[0].account_user_id,null);
  });
  await test('loyalty counts owned visits once and ignores contact matches', async () => {
    await pool.query('UPDATE loyalty_rules SET visits_required=1 WHERE visits_required=10');
    const visit={accountUserId:b,phone:'+79990000001',email:'audit-a@example.invalid',serviceCode:'bfm',bookingId:crypto.randomUUID()};
    await Promise.all([recordSuccessfulVisit(visit),recordSuccessfulVisit(visit)]);
    assert.equal((await syncLoyaltyRewards({accountUserId:a,phone:visit.phone,email:visit.email})).visits,0);
    assert.equal((await syncLoyaltyRewards({accountUserId:b})).visits,1);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM loyalty_rewards WHERE account_user_id=$1',[b])).rows[0].count,1);
  });
  await test('elapsed time does not grant visits; explicit attendance is idempotent', async () => {
    const id=await slot('2020-01-10T09:30:00+03:00');
    const past = (await pool.query("INSERT INTO bfm_bookings(slot_id,client_name,client_phone,status,account_user_id) VALUES($1,'Test','+79990000001','confirmed',$2) RETURNING id",[id,a])).rows[0].id;
    const response=await complete.GET(new NextRequest('http://localhost/api/cron/auto-complete'));
    assert.equal(response.status,200);
    assert.equal((await response.json()).count,0);
    assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1',[past])).rows[0].status,'confirmed');
    await updateAdminBooking(past,'completed');
    await updateAdminBooking(past,'completed');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM client_visits WHERE booking_id=$1',[past])).rows[0].n,1);
    assert.equal((await (await complete.GET(new NextRequest('http://localhost/api/cron/auto-complete'))).json()).count,0);
  });
  await test('invalid promotion dates return a validation error', async () => {
    const response=await promotions.PATCH(request('/api/admin/promotions',{id:crypto.randomUUID(),title:'Test',isActive:true,startsAt:'bad-date'}));
    assert.equal(response.status,400);
  });
  await test('admin cannot mark an unpaid order shipped or pretend it is bank-paid', async () => {
    const response=await adminOrders.PATCH(request(`/api/admin/orders?id=${order.id}`,{status:'shipped'}));
    assert.equal(response.status,409);
    const paid=await adminOrders.PATCH(request(`/api/admin/orders?id=${order.id}`,{status:'paid'}));
    assert.equal(paid.status,400);
  });
  await test('no-show never earns loyalty and cannot be resurrected', async () => {
    const id=await slot('2020-02-10T09:30:00+03:00');
    const visit=(await pool.query("INSERT INTO bfm_bookings(slot_id,client_name,client_phone,status,account_user_id) VALUES($1,'No show','+79990000001','confirmed',$2) RETURNING id",[id,a])).rows[0].id;
    await updateAdminBooking(visit,'no_show');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM client_visits WHERE booking_id=$1',[visit])).rows[0].n,0);
    await assert.rejects(updateAdminBooking(visit,'confirmed'),{status:409});
  });
  await test('two concurrent reschedules cannot occupy the same appointment', async () => {
    const one=await claimSlot(await slot('2099-03-01T09:30:00+03:00'),'bfm',fields(a));
    const two=await claimSlot(await slot('2099-03-02T09:30:00+03:00'),'bfm',fields(b));
    const target=await slot('2099-03-03T09:30:00+03:00');
    const moved=await Promise.all([one,two].map(x=>rescheduleBooking({bookingId:x.booking.id,serviceType:'bfm',newSlotId:target})));
    assert.equal(moved.filter(x=>x.ok).length,1);
    const pause=await createScheduleBreak({startsAt:'2099-03-04T09:00:00+03:00',endsAt:'2099-03-04T12:00:00+03:00',reason:'Test'});
    assert(pause.ok);
    const paused=await rescheduleBooking({bookingId:one.booking.id,serviceType:'bfm',newSlotId:await slot('2099-03-04T09:30:00+03:00')});
    assert.equal(paused.status,409);
  });
  await test('guest ownership needs admin verification and is audited once', async () => {
    const guest=await claimSlot(await slot('2099-04-01T09:30:00+03:00'),'bfm',fields());
    await assert.rejects(updateAdminBooking(guest.booking.id,'link_account',{email:'audit-a@example.invalid',reason:'In person',confirmed:false}),{status:400});
    const link={email:'audit-a@example.invalid',reason:'Verified in person for test',confirmed:true};
    await updateAdminBooking(guest.booking.id,'link_account',link);
    await updateAdminBooking(guest.booking.id,'link_account',link);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM booking_account_links WHERE booking_id=$1',[guest.booking.id])).rows[0].n,1);
    await assert.rejects(updateAdminBooking(guest.booking.id,'link_account',{...link,email:'audit-b@example.invalid'}),{status:409});
  });
  await test('bank callback rejects forged signature and incorrect amounts', async () => {
    const paidOrder=await createPendingOrderWithReservation(baseOrder(),[]);
    const notification={TerminalKey:'audit-terminal',PaymentId:'audit-bank-1',OrderId:paidOrder.id,Status:'CONFIRMED',Success:true,Amount:999};
    assert.equal((await callback.POST(request('/api/payment/callback',{...notification,Token:'forged'},'POST'))).status,403);
    assert.equal((await callback.POST(request('/api/payment/callback',{...notification,Token:generateToken(notification)},'POST'))).status,400);
    notification.Amount=100000;
    assert.equal((await callback.POST(request('/api/payment/callback',{...notification,Token:generateToken(notification)},'POST'))).status,200);
    await transitionOrderState(paidOrder.id,'shipped',{allowedFrom:['paid']});
    await callback.POST(request('/api/payment/callback',{...notification,Token:generateToken(notification)},'POST'));
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[paidOrder.id])).rows[0].status,'shipped');
    notification.Status='PARTIAL_REFUNDED';
    await callback.POST(request('/api/payment/callback',{...notification,Token:generateToken(notification)},'POST'));
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[paidOrder.id])).rows[0].status,'shipped');
    notification.Status='REFUNDED';
    await callback.POST(request('/api/payment/callback',{...notification,Token:generateToken(notification)},'POST'));
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[paidOrder.id])).rows[0].status,'refunded');
  });
  await test('payment initialization and hold cleanup are mutually exclusive', async () => {
    const visit=await claimSlot(await slot('2099-05-01T09:30:00+03:00'),'bfm',fields());
    const attempts=await Promise.allSettled([
      createPendingOrderWithReservation(baseOrder(),[{bookingId:visit.booking.id,bookingType:'bfm'}]),
      cancelUnpaidHold(visit.booking.id,'bfm','+79990000001'),
    ]);
    const payable=attempts[0].status==='fulfilled';
    const cancelled=attempts[1].status==='fulfilled' && attempts[1].value.ok;
    assert.notEqual(payable,cancelled);
  });
  await test('numeric consultation IDs support status changes without UUID errors', async () => {
    const visit=(await pool.query("INSERT INTO consultation_enrollments(name,phone) VALUES('Consultation','+79990000001') RETURNING id::text")).rows[0].id;
    await updateAdminBooking(visit,'confirmed');
    await updateAdminBooking(visit,'completed');
    assert.equal((await pool.query('SELECT status FROM consultation_enrollments WHERE id=$1',[visit])).rows[0].status,'completed');
  });
  const queue=require('../src/lib/appointment-notifications.js');
  const journey=require('../src/lib/booking-journey.js');
  const bookingApi=require('../src/app/api/booking/[service]/[id]/route.js');
  const paymentInit=require('../src/app/api/payment/init/route.js');
  const notificationApi=require('../src/app/api/admin/notifications/route.js');
  const casesApi=require('../src/app/api/admin/payment-cases/route.js');
  const todayApi=require('../src/app/api/admin/today/route.js');
  const {readAdminToday}=require('../src/lib/admin-today.js');
  const {reviewPaymentCase,findBookingPaymentCases}=require('../src/lib/payment-cases.js');
  await pool.query("UPDATE appointment_notifications SET status='cancelled' WHERE status IN ('queued','retry','processing')");
  sessionUser=undefined;
  let visit, token, sendCount=0;
  const accepted={sms:async()=>{sendCount++;return {status:'accepted',id:'sms-qa'};},email:async()=>{sendCount++;return {status:'accepted',id:'email-qa'};}};
  const ctx=()=>({params:Promise.resolve({service:'bfm',id:visit.booking.id})});
  const guestRequest=(suffix='',bearer=token)=>new NextRequest('http://localhost/api/booking/bfm/'+visit.booking.id+suffix,{headers:bearer?{Authorization:'Bearer '+bearer}:{}});
  await test('lost response and concurrent repeats return one booking and one channel event',async()=>{
    const access=journey.createBookingAccess();token=access.token;
    const id=await slot('2099-07-01T09:30:00+03:00');
    const input={...fields(),status:'confirmed',payment_option:'at_appointment',payment_status:'due',journey_request_key:crypto.randomUUID(),journey_access_token:token};
    const repeated=await Promise.all([claimSlot(id,'bfm',input),claimSlot(id,'bfm',input)]);
    assert(repeated.every(r=>r.ok));assert.equal(repeated[0].booking.id,repeated[1].booking.id);visit=repeated[0];
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1',[visit.booking.id])).rows[0].n,4);
    assert.equal((await claimSlot(id,'bfm',{...input,journey_access_token:journey.createBookingAccess().token})).ok,false);
  });
  await test('guest access is scoped and cost stays frozen when the price changes',async()=>{
    assert.equal((await bookingApi.GET(guestRequest('',null),ctx())).status,403);
    assert.equal((await bookingApi.GET(guestRequest('',journey.createBookingAccess().token),ctx())).status,403);
    const response=await bookingApi.GET(guestRequest(),ctx());assert.equal(response.status,200);
    const original=(await response.json()).booking.snapshot.total;
    await pool.query("UPDATE service_prices SET price=price+100 WHERE code='bfm'");
    const reread=await bookingApi.GET(guestRequest(),ctx());const payload=await reread.json();assert.equal(payload.booking.snapshot.total,original);
    assert(!JSON.stringify(payload).includes('test@example.invalid'));assert(!JSON.stringify(payload).includes('access_hash'));
    await pool.query("UPDATE service_prices SET price=price-100 WHERE code='bfm'");
  });
  await test('calendar is private, UTF-8 folded, Moscow-aligned and exactly 90 minutes',async()=>{
    const response=await bookingApi.GET(guestRequest('?format=ics'),ctx());assert.equal(response.status,200);
    const text=await response.text();assert(text.includes('DTSTART:20990701T063000Z\r\n'));assert(text.includes('DTEND:20990701T080000Z\r\n'));
    assert(text.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
    const escaped=journey.appointmentICS({...visit.booking.summary,snapshot:{...visit.booking.summary.snapshot,title:'Пример, тест; строка\n'+ 'Диплом '.repeat(30)}});
    assert(escaped.includes('Пример\\, тест\\; строка\\n'));assert(escaped.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  });
  await test('parallel workers accept each channel once without claiming delivery or payment',async()=>{
    await Promise.all([queue.processNotificationQueue(10,accepted),queue.processNotificationQueue(10,accepted)]);
    assert.equal(sendCount,2);
    const rows=(await pool.query("SELECT * FROM appointment_notifications WHERE booking_id=$1 AND event_type='confirmed'",[visit.booking.id])).rows;
    assert(rows.every(r=>r.status==='accepted'&&r.accepted_at&&!r.delivered_at&&r.attempts===1));
    const b=await journey.loadJourney('bfm',visit.booking.id);const message=queue.appointmentMessage('confirmed',b);assert(message.text.includes('Оплата — на приёме'));assert(!message.text.includes('Оплата получена'));
    assert.equal(await queue.requeueNotification(rows[0].id),false);
  });
  await test('reschedule and cancellation invalidate reminders rather than sending stale dates',async()=>{
    assert((await rescheduleBooking({bookingId:visit.booking.id,serviceType:'bfm',newSlotId:await slot('2099-07-02T09:30:00+03:00')})).ok);
    const original=(await pool.query("SELECT status FROM appointment_notifications WHERE booking_id=$1 AND revision=0 AND event_type='reminder'",[visit.booking.id])).rows;assert(original.every(r=>r.status==='cancelled'));
    await require('../src/lib/slots.js').cancelAccountBooking(visit.booking.id,'bfm',undefined);
    const text=[];await queue.processNotificationQueue(20,{sms:async(_,message)=>{text.push(message);return {status:'accepted'};},email:async(_,__,message)=>{text.push(message);return {status:'accepted'};}});
    assert.equal(text.length,2);assert(text.every(t=>t.includes('Запись отменена')));
    assert.equal((await journey.loadJourney('bfm',visit.booking.id)).status,'cancelled');
  });
  await test('temporary failure retries only that channel; no resend of accepted messages',async()=>{
    visit=await claimSlot(await slot('2099-07-03T09:30:00+03:00'),'bfm',fields());token=visit.booking.accessToken;
    let sms=0,email=0;
    const providers={sms:async()=>{sms++;return sms===1?{status:'retry',error:'provider_unavailable'}:{status:'accepted',id:'retry-qa'};},email:async()=>{email++;return {status:'accepted'};}};
    await queue.processNotificationQueue(20,providers);let row=(await pool.query("SELECT * FROM appointment_notifications WHERE booking_id=$1 AND channel='sms'",[visit.booking.id])).rows[0];assert.equal(row.status,'retry');assert.equal(row.attempts,1);
    await queue.processNotificationQueue(20,providers);assert.equal(sms,1);
    await pool.query("UPDATE appointment_notifications SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[row.id]);await queue.processNotificationQueue(20,providers);
    row=(await pool.query('SELECT * FROM appointment_notifications WHERE id=$1',[row.id])).rows[0];assert.equal(row.status,'accepted');assert.equal(row.attempts,2);assert.equal(email,1);
  });
  await test('unknown send is never blindly retried; missing configuration is an honest status',async()=>{
    visit=await claimSlot(await slot('2099-07-04T09:30:00+03:00'),'bfm',fields());token=visit.booking.accessToken;
    await queue.processNotificationQueue(20,{sms:async()=>{throw new Error('PRIVATE PHONE SECRET');},email:async()=>({status:'not_configured',error:'channel_not_configured'})});
    const rows=(await pool.query('SELECT * FROM appointment_notifications WHERE booking_id=$1',[visit.booking.id])).rows;
    assert.equal(rows.find(r=>r.channel==='sms').status,'uncertain');assert.equal(rows.find(r=>r.channel==='email').status,'not_configured');assert(!JSON.stringify(rows).includes('PRIVATE'));
    assert.equal(await queue.requeueNotification(rows.find(r=>r.channel==='sms').id),false);
    assert.equal((await journey.loadJourney('bfm',visit.booking.id)).status,'pending');
    assert.equal(await queue.requeueNotification(rows.find(r=>r.channel==='email').id),true);
    await queue.processNotificationQueue(20,accepted);
    const retried=(await pool.query("SELECT attempts,status FROM appointment_notifications WHERE booking_id=$1 AND channel='email'",[visit.booking.id])).rows[0];assert.deepEqual(retried,{attempts:2,status:'accepted'});
  });
  await test('retry budget is bounded and delivery exists only with positive provider evidence',async()=>{
    visit=await claimSlot(await slot('2099-07-05T09:30:00+03:00'),'bfm',fields());token=visit.booking.accessToken;
    for(let i=0;i<4;i++){await pool.query("UPDATE appointment_notifications SET next_attempt_at=now()-interval '1 second' WHERE booking_id=$1",[visit.booking.id]);await queue.processNotificationQueue(20,{sms:async()=>({status:'retry',error:'provider_unavailable'}),email:async()=>({status:'delivered',id:'delivery-evidence-qa'})});}
    const rows=(await pool.query('SELECT * FROM appointment_notifications WHERE booking_id=$1',[visit.booking.id])).rows;assert.equal(rows.find(r=>r.channel==='sms').status,'failed');assert.equal(rows.find(r=>r.channel==='sms').attempts,4);assert(rows.find(r=>r.channel==='email').delivered_at);
  });
  await test('failed payment init preserves the original hold and allows a safe retry',async()=>{
    const savedFetch=global.fetch;const seen=[];
    global.fetch=async(_,opts)=>{seen.push(JSON.parse(opts.body));return new Response(JSON.stringify({Success:false,Message:'Synthetic rejection'}),{status:200,headers:{'Content-Type':'application/json'}});};
    try{
      const body={orderId:'bfm-'+visit.booking.id,amount:visit.booking.summary.snapshot.total,items:[{bookingType:'bfm',bookingId:visit.booking.id}],bookingAccessToken:token,consent:true};
      const response=await paymentInit.POST(request('/api/payment/init',body,'POST'));assert.equal(response.status,502);
      assert.equal((await journey.loadJourney('bfm',visit.booking.id)).status,'pending');assert.equal(new Date((await journey.loadJourney('bfm',visit.booking.id)).hold_expires_at).toISOString(),visit.booking.summary.holdExpiresAt);
      global.fetch=async(_,opts)=>{seen.push(JSON.parse(opts.body));return new Response(JSON.stringify({Success:true,PaymentId:'synthetic-qa',PaymentURL:'https://example.invalid/qa'}),{headers:{'Content-Type':'application/json'}});};
      const retry=await paymentInit.POST(request('/api/payment/init',body,'POST'));assert.equal(retry.status,200);
      const duplicate=await paymentInit.POST(request('/api/payment/init',body,'POST'));assert.equal(duplicate.status,200);assert.equal(seen.length,2);
      assert.equal(seen[1].Amount,body.amount*100);assert.equal(seen[1].Receipt.Email,'test@example.invalid');
    }finally{global.fetch=savedFetch;}
  });
  await test('late paid cancellation creates one case; manual review never changes bank or booking facts',async()=>{
    const pending=(await pool.query("SELECT * FROM orders WHERE status='pending' AND items @> $1::jsonb",[JSON.stringify([{bookingId:visit.booking.id}])])).rows[0];
    await pool.query("UPDATE bfm_bookings SET status='cancelled' WHERE id=$1",[visit.booking.id]);
    await transitionOrderState(pending.id,'paid',{allowedFrom:['pending']});await settleBookingPayments(pending.items,'paid');await settleBookingPayments(pending.items,'paid');await findBookingPaymentCases(visit.booking.id,'bfm');
    const cases=(await pool.query('SELECT * FROM payment_cases WHERE order_id=$1',[pending.id])).rows;assert.equal(cases.length,1);
    await reviewPaymentCase(cases[0].id,'open','','Нужен ручной разбор');await reviewPaymentCase(cases[0].id,'resolved','contacted_client','Связались с тестовым клиентом');
    assert.equal((await pool.query('SELECT count(*)::int n FROM payment_case_history WHERE case_id=$1',[cases[0].id])).rows[0].n,2);
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[pending.id])).rows[0].status,'paid');assert.equal((await journey.loadJourney('bfm',visit.booking.id)).status,'cancelled');
  });
  await test('new admin endpoints enforce authorization and distinguish invalid date from empty data',async()=>{
    adminAllowed=false;
    const req=new NextRequest('http://localhost/api/admin/today');
    assert.equal((await notificationApi.GET(req)).status,401);assert.equal((await casesApi.GET(req)).status,401);assert.equal((await todayApi.GET(req)).status,401);assert.equal((await casesApi.PATCH(request('/api/admin/payment-cases',{},'PATCH'))).status,401);assert.equal((await notificationApi.POST(request('/api/admin/notifications',{},'POST'))).status,401);
    adminAllowed=true;
    const data=await readAdminToday('2099-07-03');assert(data.appointments.length>0);assert.equal(Number(data.funnel.appointment_attended),0);await assert.rejects(()=>readAdminToday('2026-02-30'));
  });
  await test('analytics needs consent and sends no contact, slot, booking id, health, URL or referrer data',async()=>{
    process.env.NEXT_PUBLIC_UMAMI_ID='synthetic-website';
    const sent=[],memory=new Map();let consent='essential';
    global.window={umami:{track:payload=>sent.push(payload)}};global.localStorage={getItem:()=>consent};global.sessionStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
    const {trackFunnel}=require('../src/lib/funnel-analytics.js');trackFunnel('booking_created',visit.booking.id);assert.equal(sent.length,0);
    consent='accepted';trackFunnel('booking_created',visit.booking.id);trackFunnel('booking_created',visit.booking.id);assert.equal(sent.length,1);
    assert.deepEqual(sent[0],{website:'synthetic-website',name:'booking_created',url:'/booking-flow',title:'Booking flow'});
    assert(!JSON.stringify(sent).includes(visit.booking.id));delete global.window;delete global.localStorage;delete global.sessionStorage;
  });
  await test('gateway ambiguity blocks another payment Init and opens a review case',async()=>{
    visit=await claimSlot(await slot('2099-07-06T09:30:00+03:00'),'bfm',fields());token=visit.booking.accessToken;
    const savedFetch=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('upstream disconnected',{status:502});};
    try{
      const body={orderId:'bfm-'+visit.booking.id,amount:visit.booking.summary.snapshot.total,items:[{bookingType:'bfm',bookingId:visit.booking.id}],bookingAccessToken:token,consent:true};
      assert.equal((await paymentInit.POST(request('/api/payment/init',body,'POST'))).status,500);
      assert.equal((await paymentInit.POST(request('/api/payment/init',body,'POST'))).status,409);assert.equal(calls,1);
      assert.equal((await journey.loadJourney('bfm',visit.booking.id)).status,'pending');
      assert.equal((await pool.query("SELECT count(*)::int n FROM payment_cases WHERE booking_id=$1 AND reason='payment_init_uncertain'",[visit.booking.id])).rows[0].n,1);
    }finally{global.fetch=savedFetch;}
  });
  await test('booking response survives admin push failure and repeats do not repeat side effects',async()=>{
    const api=require('../src/app/api/book/bfm/route.js');
    const access=journey.createBookingAccess();const body={slot_id:await slot('2099-07-07T09:30:00+03:00'),client_name:'QA client',client_phone:'+79990000001',client_email:'qa@example.invalid',payment_option:'at_appointment',consent:true,requestKey:crypto.randomUUID(),accessToken:access.token};
    const first=await api.POST(request('/api/book/bfm',body,'POST'));assert.equal(first.status,201);const payload=await first.json();assert.equal(payload.booking.summary.status,'confirmed');
    const second=await api.POST(request('/api/book/bfm',body,'POST'));assert.equal(second.status,200);assert.equal((await second.json()).booking.id,payload.booking.id);assert.equal(adminPushAttempts,1);
  });
  await test('expired holds and no-shows cannot emit obsolete created or reminder messages',async()=>{
    await pool.query("UPDATE appointment_notifications SET status='cancelled' WHERE status IN ('queued','retry')");
    visit=await claimSlot(await slot('2099-07-08T09:30:00+03:00'),'bfm',fields());
    await pool.query("UPDATE bfm_bookings SET hold_expires_at=now()-interval '1 second' WHERE id=$1",[visit.booking.id]);
    let calls=0;const providers={sms:async()=>{calls++;return {status:'accepted'};},email:async()=>{calls++;return {status:'accepted'};}};
    await queue.processNotificationQueue(20,providers);assert.equal(calls,0);
    const noshow=await claimSlot(await slot('2099-07-09T09:30:00+03:00'),'bfm',{...fields(),status:'confirmed',payment_option:'at_appointment',payment_status:'due'});
    await pool.query("UPDATE bfm_bookings SET status='cancelled',attendance='absent' WHERE id=$1",[noshow.booking.id]);
    await pool.query("UPDATE appointment_notifications SET scheduled_at=now(),next_attempt_at=now() WHERE booking_id=$1",[noshow.booking.id]);
    await queue.processNotificationQueue(20,providers);assert.equal(calls,0);assert.equal(journey.publicJourney('bfm',await journey.loadJourney('bfm',noshow.booking.id)).attendance,'absent');
  });
  await test('migration surfaces legacy paid cancellations without inventing historical prices or duplicating cases',async()=>{
    const legacyId=(await pool.query("INSERT INTO bfm_bookings(slot_id,client_name,client_phone,status) VALUES($1,'Legacy QA','+79990000001','cancelled') RETURNING id",[await slot('2099-07-10T09:30:00+03:00')])).rows[0].id;
    const legacyOrder=(await pool.query("INSERT INTO orders(external_order_id,client_name,client_phone,address,total,items,status) VALUES($1,'Legacy QA','+79990000001','QA',1000,$2,'paid') RETURNING id",[crypto.randomUUID(),JSON.stringify([{bookingId:legacyId,bookingType:'bfm'}])])).rows[0].id;
    const sql=require('node:fs').readFileSync(path.resolve(__dirname,'../migrations/019_booking_journey.sql'),'utf8');await pool.query(sql);await pool.query(sql);
    assert.equal((await pool.query('SELECT count(*)::int n FROM payment_cases WHERE order_id=$1',[legacyOrder])).rows[0].n,1);
    assert.equal((await journey.loadJourney('bfm',legacyId)).journey_snapshot,null);
  });
  await test('saved discount is not replaced by subsequently edited promo rules',async()=>{
    await pool.query("INSERT INTO promo_codes(code,discount_type,discount_value,service_codes) VALUES('QA-FROZEN10','percent',10,ARRAY['bfm'])");
    const discounted=await claimSlot(await slot('2099-07-11T09:30:00+03:00'),'bfm',{...fields(),journey_promo_code:'QA-FROZEN10'});assert(discounted.ok);
    const saved=discounted.booking.summary.snapshot;assert.equal(saved.discount,saved.subtotal*0.1);assert.equal(saved.total,saved.subtotal-saved.discount);
    await pool.query("UPDATE promo_codes SET discount_value=20 WHERE code='QA-FROZEN10'");
    const reread=journey.publicJourney('bfm',await journey.loadJourney('bfm',discounted.booking.id));assert.deepEqual(reread.snapshot,saved);
  });
  const { deleteUnreferencedSlots } = require('../src/lib/slot-deletion.js');
  const slotDeleteApi = require('../src/app/api/admin/slots/delete/route.js');
  const { cancelAccountBooking } = require('../src/lib/slots.js');
  const signIndependent = (body, secret = process.env.TINKOFF_PASSWORD) => {
    const pairs = Object.entries(body).filter(([k, v]) => k !== 'Token' && k !== 'Password' && v != null && typeof v !== 'object');
    pairs.push(['Password', secret]);
    return require('node:crypto').createHash('sha256').update(pairs.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, v]) => String(v)).join(''), 'utf8').digest('hex');
  };
  const signedCallback = body => callback.POST(request('/api/payment/callback', { ...body, Token: signIndependent(body) }, 'POST'));
  await test('A01 forged Password and absent/wrong terminal have zero order/booking/queue side effects', async () => {
    const booking = await claimSlot(await slot('2099-08-01T09:30:00+03:00'), 'bfm', fields());
    const order = await createPendingOrderWithReservation(baseOrder(), [{ bookingId: booking.booking.id, bookingType: 'bfm' }]);
    await pool.query('UPDATE orders SET payment_id=$2 WHERE id=$1', [order.id, 'hardening-adversarial']);
    const original = (await pool.query('SELECT to_jsonb(b) AS snapshot FROM bfm_bookings b WHERE id=$1', [booking.booking.id])).rows[0].snapshot;
    const originalOrder = (await pool.query('SELECT to_jsonb(o) AS snapshot FROM orders o WHERE id=$1', [order.id])).rows[0].snapshot;
    const queueCount = (await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1', [booking.booking.id])).rows[0].n;
    const body = { TerminalKey: 'audit-terminal', PaymentId: 'hardening-adversarial', OrderId: order.id, Status: 'CONFIRMED', Success: true, Amount: 100000 };
    for (const Password of ['attacker', '', 123, false, null, {}, []]) {
      const response = await callback.POST(request('/api/payment/callback', { ...body, Password, Token: signIndependent(body, String(Password)) }, 'POST'));
      assert.equal(response.status, 403);
    }
    for (const TerminalKey of [undefined, '', false, 'wrong']) assert.equal((await signedCallback({ ...body, TerminalKey })).status, 403);
    assert.deepEqual((await pool.query('SELECT to_jsonb(b) AS snapshot FROM bfm_bookings b WHERE id=$1', [booking.booking.id])).rows[0].snapshot, original);
    assert.deepEqual((await pool.query('SELECT to_jsonb(o) AS snapshot FROM orders o WHERE id=$1', [order.id])).rows[0].snapshot, originalOrder);
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1', [booking.booking.id])).rows[0].n, queueCount);
    assert.equal((await signedCallback({ ...body, Amount: 999 })).status, 400);
    assert.equal((await signedCallback({ ...body, PaymentId: 'other-payment' })).status, 409);
    assert.deepEqual((await pool.query('SELECT status,payment_status FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0], { status: 'pending', payment_status: 'pending' });
    assert.equal((await signedCallback(body)).status, 200);
    const notificationsAfter = (await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1', [booking.booking.id])).rows[0].n;
    const revisionAfter = (await pool.query('SELECT notification_revision FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0].notification_revision;
    const duplicates = await Promise.all(Array.from({ length: 10 }, () => signedCallback(body)));
    assert(duplicates.every(r => r.status === 200));
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status, 'paid');
    assert.deepEqual((await pool.query('SELECT status,payment_status,notification_revision FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0], { status: 'confirmed', payment_status: 'paid', notification_revision: revisionAfter });
    assert.equal((await pool.query('SELECT count(*)::int n FROM appointment_notifications WHERE booking_id=$1', [booking.booking.id])).rows[0].n, notificationsAfter);
    assert.equal((await pool.query('SELECT count(*)::int n FROM bfm_bookings WHERE slot_id=$1', [booking.slot.id])).rows[0].n, 1);
  });
  await test('A01 duplicate first confirmations are idempotent and competing failure preserves paid facts', async () => {
    for (let i = 0; i < 6; i++) {
      const booking = await claimSlot(await slot(`2099-08-${String(i + 2).padStart(2, '0')}T09:30:00+03:00`), 'bfm', fields());
      const order = await createPendingOrderWithReservation(baseOrder(), [{ bookingId: booking.booking.id, bookingType: 'bfm' }]);
      const PaymentId = `hardening-concurrent-${i}`;
      await pool.query('UPDATE orders SET payment_id=$2 WHERE id=$1', [order.id, PaymentId]);
      const body = { TerminalKey: 'audit-terminal', PaymentId, OrderId: order.id, Success: true, Amount: 100000 };
      const responses = await Promise.all([signedCallback({ ...body, Status: 'CONFIRMED' }), signedCallback({ ...body, Status: i % 2 ? 'REJECTED' : 'CONFIRMED' })]);
      assert(responses.every(r => r.status === 200));
      assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status, 'paid');
      const row = (await pool.query('SELECT status,payment_status FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0];
      assert.equal(row.payment_status, 'paid');
      // A genuinely failed/cancelled hold may receive a late payment; never resurrect it.
      assert(['confirmed', 'cancelled'].includes(row.status));
      assert.equal((await pool.query('SELECT count(*)::int n FROM bfm_bookings WHERE slot_id=$1', [booking.slot.id])).rows[0].n, 1);
    }
  });
  await test('A01 real callback path records late money without resurrecting a cancelled appointment', async () => {
    const booking = await claimSlot(await slot('2099-08-09T09:30:00+03:00'), 'bfm', fields());
    const order = await createPendingOrderWithReservation(baseOrder(), [{ bookingId: booking.booking.id, bookingType: 'bfm' }]);
    await pool.query('UPDATE orders SET payment_id=$2 WHERE id=$1', [order.id, 'hardening-late']);
    await cancelAccountBooking(booking.booking.id, 'bfm');
    const body = { TerminalKey: 'audit-terminal', PaymentId: 'hardening-late', OrderId: order.id, Status: 'CONFIRMED', Amount: 100000, Success: true };
    assert.equal((await signedCallback(body)).status, 200);
    assert.equal((await signedCallback(body)).status, 200);
    assert.deepEqual((await pool.query('SELECT status,payment_status,slot_id FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0], { status: 'cancelled', payment_status: 'paid', slot_id: booking.slot.id });
    assert.equal((await pool.query('SELECT count(*)::int n FROM payment_cases WHERE order_id=$1', [order.id])).rows[0].n, 1);
  });
  await test('A01 interrupted settlement returns retry and signed replay repairs order/booking consistency', async () => {
    const booking = await claimSlot(await slot('2099-08-10T09:30:00+03:00'), 'bfm', fields());
    const order = await createPendingOrderWithReservation(baseOrder(), [{ bookingId: booking.booking.id, bookingType: 'bfm' }]);
    await pool.query('UPDATE orders SET payment_id=$2 WHERE id=$1', [order.id, 'hardening-replay-repair']);
    const body = { TerminalKey: 'audit-terminal', PaymentId: 'hardening-replay-repair', OrderId: order.id, Status: 'CONFIRMED', Success: true, Amount: 100000 };
    const settlement = require('../src/lib/booking-payments.js'); const saved = settlement.settleBookingPayments;
    settlement.settleBookingPayments = async () => { throw new Error('Synthetic settlement interruption'); };
    try { assert.equal((await signedCallback(body)).status, 500); }
    finally { settlement.settleBookingPayments = saved; }
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status, 'paid');
    assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0].status, 'pending');
    assert.equal((await signedCallback(body)).status, 200);
    assert.deepEqual((await pool.query('SELECT status,payment_status FROM bfm_bookings WHERE id=$1', [booking.booking.id])).rows[0], { status: 'confirmed', payment_status: 'paid' });
  });
  await test('A02 protected member beyond the old 200-row chunk prevents any batch deletion', async () => {
    const inserted = await pool.query("INSERT INTO slots(service_type,slot_time,duration_minutes) SELECT 'bfm','2103-01-01T00:00:00+03:00'::timestamptz + n * interval '1 minute',90 FROM generate_series(0,200) n RETURNING id::text");
    const ids = inserted.rows.map(r => r.id);
    await pool.query("INSERT INTO bfm_bookings(slot_id,client_name,client_phone,status) VALUES($1,'Batch history','+79990000001','cancelled')", [ids[200]]);
    assert.equal((await deleteUnreferencedSlots(ids)).status, 409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=ANY($1::uuid[])', [ids])).rows[0].n, 201);
  });
  await test('A02 all services and statuses protect history even with stale free occupancy; batch is atomic', async () => {
    for (const service of ['bfm', 'brt', 'psychology']) for (const status of ['pending', 'confirmed', 'cancelled', 'completed']) {
      const id = await slot(`2099-09-01T${service === 'bfm' ? '09' : service === 'brt' ? '12' : '15'}:${String(['pending', 'confirmed', 'cancelled', 'completed'].indexOf(status) * 10).padStart(2, '0')}:00+03:00`, service);
      const booking = (await pool.query(`INSERT INTO ${service}_bookings(slot_id,client_name,client_phone,status) VALUES($1,'Historical fixture','+79990000001',$2) RETURNING id`, [id, status])).rows[0];
      await pool.query('UPDATE slots SET is_booked=false WHERE id=$1', [id]);
      const snapshot = (await pool.query(`SELECT to_jsonb(b) AS booking,to_jsonb(s) AS slot FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.id=$1`, [booking.id])).rows[0];
      const free = await slot(`2099-09-02T${service === 'bfm' ? '09' : service === 'brt' ? '12' : '15'}:${String(['pending', 'confirmed', 'cancelled', 'completed'].indexOf(status) * 10).padStart(2, '0')}:00+03:00`, service);
      const batch = await slotDeleteApi.POST(request('/api/admin/slots/delete', { ids: [free, id] }, 'POST'));
      assert.equal(batch.status, 409); assert((await batch.json()).error.includes('История'));
      assert.equal((await slotDeleteApi.DELETE(new NextRequest(`http://localhost/api/admin/slots/delete?id=${id}`))).status, 409);
      assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=$1', [free])).rows[0].n, 1);
      assert.deepEqual((await pool.query(`SELECT to_jsonb(b) AS booking,to_jsonb(s) AS slot FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.id=$1`, [booking.id])).rows[0], snapshot);
    }
  });
  await test('A02 free batch counts actual unique rows, missing slots count zero, malformed input is rejected', async () => {
    const id = await slot('2099-09-03T09:30:00+03:00');
    const other = await slot('2099-09-03T12:00:00+03:00');
    const response = await slotDeleteApi.POST(request('/api/admin/slots/delete', { ids: [id, id.toUpperCase(), other, crypto.randomUUID()] }, 'POST'));
    assert.equal(response.status, 200); assert.equal((await response.json()).count, 2);
    assert.equal((await (await slotDeleteApi.DELETE(new NextRequest(`http://localhost/api/admin/slots/delete?id=${id}`))).json()).count, 0);
    for (const ids of [null, [], 'bad', [123], ['bad-id'], Array(5001).fill(crypto.randomUUID())]) assert.equal((await deleteUnreferencedSlots(ids)).status, 400);
  });
  await test('A02 stale-screen deletion races with claims: either delete or booking wins, never orphaned', async () => {
    for (let i = 0; i < 12; i++) {
      const id = await slot(`2099-10-${String(i + 1).padStart(2, '0')}T09:30:00+03:00`);
      const [deleted, booked] = await Promise.all([deleteUnreferencedSlots([id]), claimSlot(id, 'bfm', fields())]);
      assert.notEqual(deleted.ok, booked.ok);
      if (booked.ok) {
        assert.equal(deleted.status, 409);
        assert.equal((await pool.query('SELECT slot_id FROM bfm_bookings WHERE id=$1', [booked.booking.id])).rows[0].slot_id, id);
      } else assert.equal(deleted.count, 1);
    }
    assert.equal((await pool.query('SELECT count(*)::int n FROM bfm_bookings WHERE slot_id IS NULL')).rows[0].n, 0);
  });
  await test('A02 target deletion races with reschedule without losing the source or creating orphan history', async () => {
    for (let i = 0; i < 8; i++) {
      const source = await slot(`2099-11-${String(i + 1).padStart(2, '0')}T09:30:00+03:00`);
      const booked = await claimSlot(source, 'bfm', fields()); assert(booked.ok);
      const target = await slot(`2099-11-${String(i + 15).padStart(2, '0')}T09:30:00+03:00`);
      const [deleted, moved] = await Promise.all([deleteUnreferencedSlots([target]), rescheduleBooking({ bookingId: booked.booking.id, serviceType: 'bfm', newSlotId: target })]);
      assert.notEqual(deleted.ok, moved.ok);
      const row = (await pool.query('SELECT slot_id FROM bfm_bookings WHERE id=$1', [booked.booking.id])).rows[0];
      assert.equal(row.slot_id, moved.ok ? target : source);
      assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=$1', [source])).rows[0].n, 1);
    }
  });
  await test('A02 concurrent cancellation cannot make its historical slot deletable', async () => {
    for (let i = 0; i < 8; i++) {
      const id = await slot(`2099-12-${String(i + 1).padStart(2, '0')}T09:30:00+03:00`);
      const booked = await claimSlot(id, 'bfm', fields()); assert(booked.ok);
      const [deleted, cancelled] = await Promise.all([deleteUnreferencedSlots([id]), cancelAccountBooking(booked.booking.id, 'bfm')]);
      assert.equal(deleted.status, 409); assert(cancelled.ok);
      assert.deepEqual((await pool.query('SELECT status,slot_id FROM bfm_bookings WHERE id=$1', [booked.booking.id])).rows[0], { status: 'cancelled', slot_id: id });
      assert.equal((await pool.query('SELECT is_booked FROM slots WHERE id=$1', [id])).rows[0].is_booked, false);
    }
  });
  await test('A02 SQL failure during DELETE rolls back the entire batch', async () => {
    const one = await slot('2100-01-01T09:30:00+03:00'); const two = await slot('2100-01-02T09:30:00+03:00');
    await pool.query(`CREATE FUNCTION hardening_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id='${two}'::uuid THEN RAISE EXCEPTION 'test-only delete failure'; END IF; RETURN OLD; END $$`);
    await pool.query('CREATE TRIGGER hardening_fail_delete BEFORE DELETE ON slots FOR EACH ROW EXECUTE FUNCTION hardening_fail_delete()');
    try {
      await assert.rejects(deleteUnreferencedSlots([one, two]), /test-only delete failure/);
      assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=ANY($1::uuid[])', [[one, two]])).rows[0].n, 2);
    } finally {
      await pool.query('DROP TRIGGER hardening_fail_delete ON slots'); await pool.query('DROP FUNCTION hardening_fail_delete()');
    }
  });
  await test('scheduling invariants: 20 contenders one winner, exact service, adjacent window and break boundary', async () => {
    const id = await slot('2100-02-01T09:30:00+03:00');
    const attempts = await Promise.all(Array.from({ length: 20 }, () => claimSlot(id, 'bfm', fields())));
    assert.equal(attempts.filter(r => r.ok).length, 1);
    assert.equal((await claimSlot(await slot('2100-02-01T10:00:00+03:00', 'psychology'), 'psychology', { ...fields(), booking_type: 'offline' })).status, 409);
    assert((await claimSlot(await slot('2100-02-01T11:00:00+03:00', 'psychology'), 'psychology', { ...fields(), booking_type: 'offline' })).ok);
    assert.equal((await claimSlot(await slot('2100-02-02T09:30:00+03:00', 'brt'), 'bfm', fields())).ok, false);
    assert.equal((await claimSlot(crypto.randomUUID(), 'bfm', fields())).ok, false);
    assert.equal((await claimSlot(await slot('2020-01-01T09:30:00+03:00'), 'bfm', fields())).ok, false);
    assert((await createScheduleBreak({ startsAt: '2100-02-03T09:45:00+03:00', endsAt: '2100-02-03T10:15:00+03:00', reason: 'Hardening fixture' })).ok);
    assert.equal((await claimSlot(await slot('2100-02-03T09:30:00+03:00'), 'bfm', fields())).ok, false);
    assert((await claimSlot(await slot('2100-02-03T10:15:00+03:00'), 'bfm', fields())).ok);
  });
  await test('real isolated Redis sessions protect slot mutations via proxy: anonymous/forged/revoked/expired', async () => {
    const redisUrl = new URL(process.env.REDIS_URL || '');
    if (redisUrl.hostname !== '127.0.0.1' || redisUrl.port !== '16379') throw new Error('Only the isolated Redis on port 16379 is allowed');
    const savedAdminMock = mocks['@/lib/admin-auth']; const savedRedisMock = mocks['@/lib/redis'];
    delete mocks['@/lib/admin-auth']; delete mocks['@/lib/redis'];
    const realAuth = require('../src/lib/admin-auth.js');
    const realRedis = require('../src/lib/redis.js');
    const { proxy } = require('../src/proxy.js');
    const client = await realRedis.getRedis(); assert(client?.isReady);
    const id = await slot('2100-03-01T09:30:00+03:00');
    const dispatch = async headers => {
      const req = new NextRequest(`http://localhost/api/admin/slots/delete?id=${id}`, { method: 'DELETE', headers });
      const gate = await proxy(req); return gate.status === 401 ? gate : slotDeleteApi.DELETE(req);
    };
    try {
      assert.equal((await dispatch({})).status, 401);
      assert.equal((await dispatch({ Cookie: `admin_session=${crypto.randomUUID()}` })).status, 401);
      const revoked = await realAuth.createAdminSessionToken(); await realAuth.revokeAdminSessionToken(revoked);
      assert.equal((await dispatch({ Authorization: `Bearer ${revoked}` })).status, 401);
      const expired = await realAuth.createAdminSessionToken(); await client.pExpire(`admin-session:${expired}`, 1);
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal((await dispatch({ Cookie: `admin_session=${expired}` })).status, 401);
      const rotated = await realAuth.createAdminSessionToken(); await realAuth.rotateAdminSessionVersion();
      assert.equal((await dispatch({ Cookie: `admin_session=${rotated}` })).status, 401);
      assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE id=$1', [id])).rows[0].n, 1);
      const valid = await realAuth.createAdminSessionToken();
      assert.equal((await dispatch({ Cookie: `admin_session=${valid}` })).status, 200);
      const bearer = await dispatch({ Authorization: `Bearer ${valid}` }); assert.equal(bearer.status, 200); assert.equal((await bearer.json()).count, 0);
      await realAuth.revokeAdminSessionToken(valid);
    } finally {
      mocks['@/lib/admin-auth'] = savedAdminMock; mocks['@/lib/redis'] = savedRedisMock; await client.quit();
    }
  });
  console.log(JSON.stringify({passed:results.length,tests:results}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());
