const assert=require('node:assert/strict');
const path=require('node:path');
const Module=require('node:module');
const {spawnSync}=require('node:child_process');
const {AsyncLocalStorage}=require('node:async_hooks');
const url=new URL(process.env.DATABASE_URL);
if(url.hostname!=='127.0.0.1'||url.port!=='15432'||!/^\/audit_regression_[0-9]+$/.test(url.pathname)||process.env.POSTGRES_POOL_SIZE!=='10') throw Error('New isolated DB/pool10 required');
global.fetch=async()=>{throw Error('Provider traffic forbidden');};
for(const protocol of ['node:http','node:https']) require(protocol).request=()=>{throw Error('Provider traffic forbidden');};
assert.equal(spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/migrate.mjs')],{env:process.env,stdio:'inherit'}).status,0);
let allowed=true,sessionUser=null;
const mocks={'@/lib/admin-auth':{requireAdmin:async()=>allowed?null:new Response(null,{status:401})},
  '@/lib/account-auth':{getAccountSession:async()=>sessionUser?{userId:sessionUser}:null},
  '@/lib/redis':{cacheGet:async()=>null,cacheSet:async()=>{},cacheDelete:async()=>{},cacheIncrement:async()=>1},
  '@/lib/telegram':{sendTelegram:async()=>true},'@/lib/push':{sendPushToAdmin:async()=>true}};
const load=Module._load;
Module._load=function(request,parent,main){
  if(mocks[request]) return mocks[request];
  if(request==='next/server') return {...load.call(this,'next/dist/server/web/spec-extension/request',parent,main),...load.call(this,'next/dist/server/web/spec-extension/response',parent,main)};
  if(request.startsWith('@/')) request=path.resolve(__dirname,'../src',request.slice(2))+'.js';
  return load.call(this,request,parent,main);
};
const {db,pool}=require('../src/lib/db.js');
const {NextRequest}=require('next/server');
const plan=require('../src/lib/schedule-plan.js');
const management=require('../src/lib/schedule-management.js');
const slots=require('../src/lib/slots.js');
const scheduling=require('../src/app/api/admin/scheduling/route.js');
const admin=require('../src/app/api/admin/bookings/route.js');
const list=require('../src/app/api/admin/slots/list/route.js');
const batch=require('../src/app/api/admin/slots/batch/route.js');
const calendar=require('../src/app/api/admin/calendar/route.js');
const clientSearch=require('../src/app/api/admin/scheduling/clients/route.js');
const {deleteUnreferencedSlots}=require('../src/lib/slot-deletion.js');
const {processNotificationQueue}=require('../src/lib/appointment-notifications.js');
const asyncContext=new AsyncLocalStorage();
const connect=pool.connect.bind(pool),transaction=db.transaction.bind(db);
let nested=0;
pool.connect=function(...args){if(asyncContext.getStore()){nested++;throw Error('Nested connection');} return connect(...args);};
db.transaction=callback=>transaction(client=>asyncContext.run(true,()=>callback(client)));
const fields={client_name:'Synthetic V2',client_phone:'+79990000001',client_email:'v2@example.invalid',status:'confirmed',payment_option:'at_appointment',payment_status:'due'};
const hours={start:'09:30',end:'18:30',step:30,services:['bfm','brt','psychology'],breaks:[]};
const req=(endpoint,body,method='POST')=>new NextRequest(`http://localhost${endpoint}`,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
const tests=[];
async function test(name,fn){const start=performance.now();await fn();assert.equal(nested,0);tests.push({name,ms:Math.round(performance.now()-start)});console.log('PASS',JSON.stringify(tests.at(-1)));}
const preview=p=>management.withScheduleTransaction(c=>management.previewSchedule(c,p));
const apply=async p=>{const pre=await preview(p);return management.applySchedule(p,pre.token,crypto.randomUUID());};
const slot=async(day,time='09:30',service='bfm')=>(await pool.query('INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES($1,$2,$3) RETURNING id::text',[service,plan.moscowInstant(day,plan.minutes(time)),slots.SERVICE_DURATION_MINUTES[service]])).rows[0].id;

(async()=>{
  await test('date normalization, Moscow midnight, weekdays and whole procedure fits workday',async()=>{
    assert.throws(()=>plan.validDay('2026-02-31'),/дата/);assert.throws(()=>plan.validDay('2026-99-01'),/дата/);
    assert.equal(plan.moscowInstant('2101-01-01',0),'2100-12-31T21:00:00.000Z');
    const p=plan.normalizePlan({from:'2101-01-01',to:'2101-01-10',weekdays:[1],hours});
    assert(p.dates.every(d=>new Date(`${d}T12:00Z`).getUTCDay()===1));
    const starts=plan.generateStarts({dates:['2101-01-02'],hours,reason:''});
    assert(starts.every(s=>Date.parse(s.time)+s.duration*60000<=Date.parse(plan.moscowInstant(s.day,1110))));
    assert.throws(()=>plan.generateStarts({dates:plan.dateRange('2101-01-01','2101-12-31'),hours,reason:''}),/5000/);
  });
  await test('multi-date apply counts actual inserts, dedupes and idempotent repeat',async()=>{
    const p=plan.normalizePlan({dates:['2101-02-03','2101-02-05','2101-02-11','2101-02-17','2101-02-24','2101-02-03'],hours});
    const pre=await preview(p),key=crypto.randomUUID();
    const one=await management.applySchedule(p,pre.token,key),two=await management.applySchedule(p,pre.token,key);
    assert.deepEqual(one,two);assert.equal(one.created,pre.counts.created);assert.equal(one.dates.length,5);
    const again=await apply(p);assert.equal(again.created,0);assert.equal(again.existing,one.created);
  });
  await test('stale preview rejects entire commit without partial inserts',async()=>{
    const p={dates:['2101-03-01'],hours,reason:''},pre=await preview(p);
    await slots.createScheduleBreak({startsAt:plan.moscowInstant(p.dates[0],720),endsAt:plan.moscowInstant(p.dates[0],780),reason:'QA'});
    await assert.rejects(management.applySchedule(p,pre.token,crypto.randomUUID()),e=>e.status===409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time>=$1 AND slot_time<$2',[plan.moscowInstant(p.dates[0],0),plan.moscowInstant(p.dates[0],1440)])).rows[0].n,0);
  });
  await test('day closure with active booking rolls back exception and all blocks',async()=>{
    const id=await slot('2101-03-02');assert((await slots.claimSlot(id,'bfm',fields)).ok);
    await assert.rejects(management.setScheduleExceptions(['2101-03-02'],null,'Vacation'),e=>e.status===409);
    assert.equal((await pool.query("SELECT count(*)::int n FROM schedule_exceptions WHERE day='2101-03-02'")).rows[0].n,0);
  });
  await test('vacation and temporary hours are durable across services; clearing keeps manual breaks',async()=>{
    await apply({dates:['2101-03-03','2101-03-04'],hours,reason:''});
    await management.setScheduleExceptions(['2101-03-03'],null,'Vacation');
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time>=$1 AND slot_time<$2 AND NOT is_booked',[plan.moscowInstant('2101-03-03',0),plan.moscowInstant('2101-03-03',1440)])).rows[0].n,0);
    await slots.createScheduleBreak({startsAt:plan.moscowInstant('2101-03-04',720),endsAt:plan.moscowInstant('2101-03-04',780),reason:'Manual'});
    await management.setScheduleExceptions(['2101-03-04'],{...hours,start:'11:00',end:'16:00'},'Temporary hours');
    await management.clearScheduleExceptions(['2101-03-04']);
    assert.equal((await pool.query("SELECT count(*)::int n FROM schedule_breaks WHERE reason='Manual'")).rows[0].n,1);
  });
  await test('admin exact consent, atomic create failure and no duration rewrite',async()=>{
    const body={service_type:'bfm',slot_time:plan.moscowInstant('2101-04-01',570),client_name:'Synthetic',client_phone:'9990000001'};
    assert.equal((await admin.POST(req('/api/admin/bookings',body))).status,400);
    await slots.createScheduleBreak({startsAt:body.slot_time,endsAt:plan.moscowInstant('2101-04-01',660),reason:'Closed'});
    assert.equal((await admin.POST(req('/api/admin/bookings',{...body,consent_confirmed:true}))).status,409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time=$1',[body.slot_time])).rows[0].n,0);
    const id=await slot('2101-04-02');await pool.query('UPDATE slots SET duration_minutes=100 WHERE id=$1',[id]);
    assert.equal((await batch.POST(req('/api/admin/slots/batch',{slots:[{service_type:'bfm',slot_time:plan.moscowInstant('2101-04-02',570)}]}))).status,201);
    assert.equal((await pool.query('SELECT duration_minutes FROM slots WHERE id=$1',[id])).rows[0].duration_minutes,100);
  });
  await test('reschedule same-slot no-op; append-only old/new history protects both slots',async()=>{
    const id=await slot('2101-04-03'),target=await slot('2101-04-04');
    const booking=await slots.claimSlot(id,'bfm',fields);assert(booking.ok);
    const before=(await pool.query('SELECT notification_revision FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].notification_revision;
    assert((await slots.rescheduleBooking({bookingId:booking.booking.id,serviceType:'bfm',newSlotId:id})).noop);
    assert((await slots.rescheduleBooking({bookingId:booking.booking.id.toUpperCase(),serviceType:'bfm',newSlotId:id.toUpperCase()})).noop);
    assert.equal((await pool.query('SELECT notification_revision FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].notification_revision,before);
    assert((await slots.rescheduleBooking({bookingId:booking.booking.id,serviceType:'bfm',newSlotId:target,actor:'admin',reason:'Client request'})).ok);
    const events=(await pool.query('SELECT * FROM booking_events WHERE booking_id=$1 ORDER BY id',[booking.booking.id])).rows;
    assert.equal(events.length,2);assert.equal(events[1].old_slot_id,id);assert.equal(events[1].new_slot_id,target);assert.equal(events[1].actor,'admin');
    assert.equal((await deleteUnreferencedSlots([id])).status,409);
    await assert.rejects(pool.query('DELETE FROM booking_events WHERE booking_id=$1',[booking.booking.id]),/append-only/);
    await slots.cancelAccountBooking(booking.booking.id,'bfm');
    assert.equal((await admin.DELETE(req('/api/admin/bookings',{id:booking.booking.id},'DELETE'))).status,200);
    assert((await pool.query('SELECT archived_at FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].archived_at);
  });
  await test('range loading has truthful pagination and direct admin gates',async()=>{
    const endpoint='/api/admin/slots/list?from=2101-02-01&to=2101-02-28&limit=10';
    const response=await list.GET(req(endpoint,null,'GET')),data=await response.json();
    assert.equal(data.slots.length,10);assert(data.counts.total>10);assert.equal(data.next_offset,10);
    const second=await(await list.GET(req(endpoint+'&offset=10',null,'GET'))).json();
    assert(!second.slots.some(s=>data.slots.some(a=>a.id===s.id)));
    allowed=false;
    assert.equal((await list.GET(req(endpoint,null,'GET'))).status,401);
    assert.equal((await scheduling.POST(req('/api/admin/scheduling',{action:'preview'}))).status,401);
    assert.equal((await admin.POST(req('/api/admin/bookings',{}))).status,401);
    allowed=true;
  });
  await test('template version conflicts roll back activation; dry run and cron are idempotent and preserve exceptions',async()=>{
    const week=[null,hours,hours,null,hours,hours,hours];
    const t=await management.saveScheduleTemplate({name:'QA week',week,horizon:7,active:true});
    await assert.rejects(management.saveScheduleTemplate({id:t.id,version:0,name:'Stale',week,horizon:7,active:true}),e=>e.status===409);
    assert.equal((await pool.query('SELECT id FROM schedule_templates WHERE active')).rows[0].id,t.id);
    const tomorrow=plan.dayAfter(new Date(Date.now()+3*3600000).toISOString().slice(0,10));
    await management.setScheduleExceptions([tomorrow],null,'QA holiday');
    const dry=await management.extendSchedule(true);assert.equal(dry.dry_run,true);
    assert.equal((await pool.query('SELECT count(*)::int n FROM schedule_runs')).rows[0].n,0);
    const first=await management.extendSchedule(),second=await management.extendSchedule();
    assert(first.ok);assert.equal(second.count,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time>=$1 AND slot_time<$2 AND NOT is_booked',[plan.moscowInstant(tomorrow,0),plan.moscowInstant(tomorrow,1440)])).rows[0].n,0);
  });
  await test('slow provider has no scheduling lock or connection; stale in-flight result stays uncertain',async()=>{
    await pool.query("UPDATE appointment_notifications SET status='cancelled' WHERE status IN ('queued','retry')");
    const id=await slot('2101-05-01'),booking=await slots.claimSlot(id,'bfm',fields);assert(booking.ok);
    let begin,finish;
    const started=new Promise(r=>begin=r),pending=new Promise(r=>finish=r);
    const worker=processNotificationQueue(1,{sms:async()=>{begin();return pending;},email:async()=>{begin();return pending;}},1000);
    await started;
    // A separate scheduling operation must finish before the provider resolves.
    await Promise.race([slots.cancelAccountBooking(booking.booking.id,'bfm'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Provider holds scheduling lock')),500))]);
    finish({status:'accepted',id:'synthetic'});await worker;
    const r=await pool.query('SELECT status FROM appointment_notifications WHERE booking_id=$1 AND send_started_at IS NOT NULL',[booking.booking.id]);
    assert.equal(r.rows[0].status,'uncertain');
  });
  await test('template period preview/apply, stale edit, copy and window close/reopen are real mutations',async()=>{
    const t=await management.saveScheduleTemplate({name:'Period QA',week:Array(7).fill(hours),horizon:7,active:false});
    const dates=['2102-01-01','2102-01-02'],pre=await management.withScheduleTransaction(c=>management.previewTemplate(c,t.id,dates)),key=crypto.randomUUID();
    const one=await management.applyTemplate(t.id,dates,pre.token,key);
    assert(one.created>0);assert.deepEqual(await management.applyTemplate(t.id,dates,pre.token,key),one);
    const stale=await management.withScheduleTransaction(c=>management.previewTemplate(c,t.id,['2102-01-03']));
    await management.saveScheduleTemplate({id:t.id,version:t.version,name:t.name,week:Array(7).fill({...hours,end:'17:00'}),horizon:7,active:false});
    await assert.rejects(management.applyTemplate(t.id,['2102-01-03'],stale.token,crypto.randomUUID()),e=>e.status===409);
    const p=await management.withScheduleTransaction(c=>management.copyDayPlan(c,dates[0],['2102-02-01']));
    assert.equal(p.hours.start,'09:30');assert.deepEqual(p.hours.services,hours.services);assert((await apply(p)).created>0);
    const target=(await pool.query('SELECT id::text FROM slots WHERE service_type=\'bfm\' AND slot_time=$1',[plan.moscowInstant(dates[0],570)])).rows[0].id;
    assert.equal((await management.changeWindows([target],true)).changed,1);
    assert.equal((await management.changeWindows([target],true)).changed,0);
    assert.equal((await pool.query('SELECT is_booked FROM slots WHERE id=$1',[target])).rows[0].is_booked,true);
    assert.equal((await management.changeWindows([target],false)).changed,1);
    assert.equal((await pool.query('SELECT is_booked FROM slots WHERE id=$1',[target])).rows[0].is_booked,false);
    const response=await calendar.GET(req('/api/admin/calendar?from=2102-01-01&to=2102-01-02',null,'GET'));assert.equal(response.status,200);
    const data=await response.json();assert(data.slots.length>0);assert.equal(data.days.length,2);
  });
  await test('5000 actual slot inserts, 5001 rejected, duplicate repeat counts zero and preserves durations',async()=>{
    const start=Date.parse(plan.moscowInstant('2103-01-01',0));
    const input=Array.from({length:5000},(_,i)=>({service_type:'brt',slot_time:new Date(start+i*30*60000).toISOString()}));
    const rejected=await batch.POST(req('/api/admin/slots/batch',{slots:[...input,input[0]]}));assert.equal(rejected.status,400);
    const response=await batch.POST(req('/api/admin/slots/batch',{slots:input}));assert.equal(response.status,201);assert.equal((await response.json()).count,5000);
    const repeated=await batch.POST(req('/api/admin/slots/batch',{slots:input}));assert.equal((await repeated.json()).count,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time>=$1 AND slot_time<=$2 AND duration_minutes=60',[input[0].slot_time,input.at(-1).slot_time])).rows[0].n,5000);
  });
  await test('booking vs close-window competition has one winner and no partially persisted state',async()=>{
    const target=await slot('2104-01-01');
    const [claim,closure]=await Promise.allSettled([slots.claimSlot(target,'bfm',fields),management.changeWindows([target],true)]);
    const booked=claim.status==='fulfilled'&&claim.value.ok;
    const closed=closure.status==='fulfilled'&&closure.value.changed===1;
    assert.notEqual(booked,closed);assert(booked||closed);
    if(booked)assert.equal(closure.reason.status,409);else assert.equal(claim.value.status,409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM bfm_bookings WHERE slot_id=$1',[target])).rows[0].n,booked?1:0);
  });
  await test('server booking totals/search/pagination and account linking require explicit identity',async()=>{
    const first=await admin.GET(req('/api/admin/bookings?limit=1',null,'GET')),data=await first.json();assert.equal(first.status,200);assert.equal(data.bookings.length,1);assert(data.counts.total>1);assert.equal(data.next_offset,1);
    const second=await(await admin.GET(req('/api/admin/bookings?limit=1&offset=1',null,'GET'))).json();assert.notEqual(data.bookings[0].id,second.bookings[0].id);
    const account=(await pool.query("INSERT INTO account_users(display_name,email,phone,consent_version,consent_at,verified_at) VALUES('QA Existing Client','existing-v2@example.invalid','+79990000999','qa',now(),now()) RETURNING id::text")).rows[0].id;
    const body={service_type:'bfm',slot_time:plan.moscowInstant('2104-02-01',570),client_name:'QA Existing Client',client_phone:'9990000999',consent_confirmed:true,account_user_id:account};
    assert.equal((await admin.POST(req('/api/admin/bookings',body))).status,400);
    const created=await admin.POST(req('/api/admin/bookings',{...body,identity_confirmed:true}));assert.equal(created.status,201);
    const booking=(await created.json()).booking;
    assert.equal((await pool.query('SELECT account_user_id FROM bfm_bookings WHERE id=$1',[booking.id])).rows[0].account_user_id,account);
    const searched=await(await admin.GET(req('/api/admin/bookings?q=Existing%20Client',null,'GET'))).json();assert.equal(searched.counts.total,1);
    allowed=false;assert.equal((await calendar.GET(req('/api/admin/calendar?from=2104-01-01&to=2104-01-01',null,'GET'))).status,401);assert.equal((await clientSearch.GET(req('/api/admin/scheduling/clients?q=Existing',null,'GET'))).status,401);allowed=true;
    const clients=await(await clientSearch.GET(req('/api/admin/scheduling/clients?q=Existing',null,'GET'))).json();assert.equal(clients.clients[0].id,account);assert.equal(Object.keys(clients.clients[0]).length,4);
  });
  await test('A05 both client entry points and UUID spellings share real Redis quota before scheduling lock',async()=>{
    const receipt=require('../src/app/api/booking/[service]/[id]/route.js');
    const accountRoute=require('../src/app/api/account/bookings/route.js');
    const {getRedis}=require('../src/lib/redis.js');const redis=await getRedis();assert(redis?.isReady);
    const account=(await pool.query("SELECT id::text FROM account_users WHERE email='existing-v2@example.invalid'")).rows[0].id;
    const id=await slot('2104-03-01'),created=await slots.claimSlot(id,'bfm',{...fields,account_user_id:account});assert(created.ok);
    const bookingId=created.booking.id,ctx={params:Promise.resolve({service:'bfm',id:bookingId.toUpperCase()})};
    const before=(await pool.query('SELECT notification_revision,updated_at,journey_snapshot FROM bfm_bookings WHERE id=$1',[bookingId])).rows[0];
    sessionUser=account;
    for(let i=0;i<12;i++){
      const response=i%2?await receipt.PATCH(req('/api/booking/bfm/'+bookingId,{action:'reschedule',slot_id:id.toUpperCase()},'PATCH'),ctx):await accountRoute.PATCH(req('/api/account/bookings',{id:bookingId,service_type:'bfm',action:'reschedule',slot_id:id},'PATCH'));
      assert.equal(response.status,200);
    }
    const key=`rate-limit:booking-reschedule:booking:bfm:${bookingId}`;assert.equal(await redis.get(key),'12');assert((await redis.ttl(key))>0);
    const denied=await receipt.PATCH(req('/api/booking/bfm/'+bookingId,{action:'reschedule',slot_id:id},'PATCH'),ctx);assert.equal(denied.status,429);assert.equal(denied.headers.get('Retry-After'),'900');
    assert.deepEqual((await pool.query('SELECT notification_revision,updated_at,journey_snapshot FROM bfm_bookings WHERE id=$1',[bookingId])).rows[0],before);
    assert.equal((await pool.query("SELECT count(*)::int n FROM booking_events WHERE booking_id=$1 AND event_type='rescheduled'",[bookingId])).rows[0].n,0);
    await redis.del(key);
    const parallel=await Promise.all(Array.from({length:40},(_,i)=>i%2?receipt.PATCH(req('/api/booking/bfm/'+bookingId,{action:'reschedule',slot_id:id.toUpperCase()},'PATCH'),ctx):accountRoute.PATCH(req('/api/account/bookings',{id:bookingId.toUpperCase(),service_type:'bfm',action:'reschedule',slot_id:id},'PATCH'))));
    assert.equal(parallel.filter(r=>r.status===200).length,12);assert.equal(parallel.filter(r=>r.status===429).length,28);
    assert.equal(await redis.get(key),'40');
    assert.deepEqual((await pool.query('SELECT notification_revision,updated_at,journey_snapshot FROM bfm_bookings WHERE id=$1',[bookingId])).rows[0],before);
    await redis.del(key);await redis.quit();sessionUser=null;
  });
  await test('A05 development fallback counts concurrent attempts; production refuses missing Redis',async()=>{
    const rate=require('../src/lib/booking-reschedule-rate.js'),savedUrl=process.env.REDIS_URL,savedMode=process.env.NODE_ENV;
    try{
      delete process.env.REDIS_URL;process.env.NODE_ENV='development';const id=crypto.randomUUID();
      const results=await Promise.all(Array.from({length:40},(_,i)=>rate.checkBookingRescheduleLimit('bfm',i%2?id.toUpperCase():id)));
      assert.equal(results.filter(Boolean).length,12);
      process.env.NODE_ENV='production';await assert.rejects(rate.checkBookingRescheduleLimit('bfm',crypto.randomUUID()),/requires Redis/);
    }finally{if(savedUrl===undefined)delete process.env.REDIS_URL;else process.env.REDIS_URL=savedUrl;if(savedMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=savedMode;}
  });
  await test('generator breaks block existing starts and conflict rollback is all-or-nothing',async()=>{
    const day='2104-04-01';await apply({dates:[day],hours,reason:''});
    const withPause={dates:[day],hours:{...hours,breaks:[{start:'12:00',end:'13:00'}]},reason:'Generated break'};
    const pre=await preview(withPause);assert(pre.counts.blocked>0);const result=await management.applySchedule(withPause,pre.token,crypto.randomUUID());assert.equal(result.breaks_created,1);
    const repeated=await apply(withPause);assert.equal(repeated.breaks_created,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM slots WHERE slot_time=$1 AND NOT is_booked',[plan.moscowInstant(day,720)])).rows[0].n,0);
    const conflictDay='2104-04-02',id=await slot(conflictDay,'12:00');assert((await slots.claimSlot(id,'bfm',fields)).ok);
    const p={...withPause,dates:[conflictDay]},conflict=await preview(p);assert(conflict.breakConflicts>0);
    await assert.rejects(management.applySchedule(p,conflict.token,crypto.randomUUID()),e=>e.status===409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM schedule_breaks WHERE starts_at=$1',[plan.moscowInstant(conflictDay,720)])).rows[0].n,0);
  });
  await test('provider timeout stays uncertain without retry and releases pool/lock',async()=>{
    await pool.query("UPDATE appointment_notifications SET status='cancelled' WHERE status IN ('queued','retry')");
    const id=await slot('2105-01-01'),created=await slots.claimSlot(id,'bfm',fields);assert(created.ok);
    await processNotificationQueue(1,{sms:async()=>new Promise(()=>{}),email:async()=>new Promise(()=>{})},1000);
    const row=(await pool.query('SELECT status,last_error FROM appointment_notifications WHERE booking_id=$1 AND send_started_at IS NOT NULL',[created.booking.id])).rows[0];
    assert.equal(row.status,'uncertain');assert.equal(row.last_error,'provider_outcome_unknown');
    assert((await slots.cancelAccountBooking(created.booking.id,'bfm')).ok);assert.equal(pool.waitingCount,0);
  });
  await test('injected failure after first changed date rolls back the complete multi-date exception',async()=>{
    const dates=['2105-02-01','2105-02-02'];await apply({dates,hours,reason:''});
    await pool.query(`CREATE FUNCTION scheduling_v2_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.day='2105-02-02' THEN RAISE EXCEPTION 'Synthetic date write failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER scheduling_v2_failure BEFORE UPDATE ON schedule_days FOR EACH ROW EXECUTE FUNCTION scheduling_v2_failure()`);
    try{await assert.rejects(management.setScheduleExceptions(dates,null,'Fail transaction'),/Synthetic date write failure/);}
    finally{await pool.query('DROP TRIGGER scheduling_v2_failure ON schedule_days; DROP FUNCTION scheduling_v2_failure()');}
    assert.equal((await pool.query('SELECT count(*)::int n FROM schedule_exceptions WHERE day=ANY($1::date[])',[dates])).rows[0].n,0);
    assert.equal((await pool.query("SELECT count(*)::int n FROM schedule_days WHERE day=ANY($1::date[]) AND mode='published'",[dates])).rows[0].n,2);
    assert.equal((await pool.query('SELECT count(*)::int n FROM schedule_breaks WHERE starts_at>=$1 AND starts_at<$2',[plan.moscowInstant(dates[0],0),plan.moscowInstant(plan.dayAfter(dates[1]),0)])).rows[0].n,0);
  });
  await test('admin create request-key retries return one booking; mismatched reuse cannot change data',async()=>{
    const body={service_type:'bfm',slot_time:plan.moscowInstant('2105-03-01',570),client_name:'Idempotent admin client',client_phone:'9990000001',consent_confirmed:true,request_key:crypto.randomUUID()};
    const responses=await Promise.all(Array.from({length:10},()=>admin.POST(req('/api/admin/bookings',body))));
    assert.equal(responses.filter(r=>r.status===201).length,1);assert.equal(responses.filter(r=>r.status===200).length,9);
    const ids=await Promise.all(responses.map(async r=>(await r.json()).booking.id));assert.equal(new Set(ids).size,1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM booking_events WHERE booking_id=$1',[ids[0]])).rows[0].n,1);
    assert.equal((await admin.POST(req('/api/admin/bookings',{...body,client_name:'Different request'}))).status,409);
    const metadata=await (await scheduling.GET(req('/api/admin/scheduling'))).json();
    const moscow=new Date(Date.parse(metadata.generation.next_run_at)+3*3600000);
    assert.equal(moscow.getUTCDay(),0);assert.equal(moscow.getUTCHours(),3);assert.equal(moscow.getUTCMinutes(),15);
    assert(Date.parse(metadata.generation.next_run_at)>Date.now());assert(metadata.generation.published_through);
  });
  assert.equal(pool.waitingCount,0);console.log(JSON.stringify({passed:tests.length,nestedCheckouts:nested,tests}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
