// Synthetic only: no database credentials, network, log payloads or real contacts.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const id='00000000-0000-4000-8000-000000000001',account='00000000-0000-4000-8000-000000000002';
const book={id,client_name:'Синтетический клиент',client_phone:'9000000000',client_email:'synthetic@example.invalid',slot_time:'2026-10-18T11:30:00Z',status:'confirmed',payment_status:'paid',notification_revision:3,journey_snapshot:{title:'Тестовая услуга',total:999999},account_user_id:null};
function setup(){
 const env={NOTIFICATIONS_MAX_V1_ENABLED:'true',NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'true',NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED:'true',NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE:'2026-01-01T00:00:00Z'};
 const calls=[];let booking={...book},history={old_time:'2026-10-17T10:00:00Z',new_time:book.slot_time},accountEmail='verified@example.invalid';
 const context={exports:{},URL,Date,Intl,Object,process:{env},require:name=>{
  if(name!=='@/lib/booking-journey')throw Error('unexpected dependency');
  return {isJourneyService:v=>['bfm','brt','psychology'].includes(v),validBookingId:v=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),loadJourney:async(service,value,client)=>{
   calls.push(['load',service,value,client]);return booking;
  }};
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-max-notification.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const client={query:async(sql,args)=>{calls.push([sql,args]);return {rows:sql.includes('booking_events')?(history?[history]:[]):accountEmail?[{email:accountEmail}]:[]};}};
 const row=(kind='confirmed',extra={})=>({event_type:kind,event_key:`v1:admin:bfm:${id}:${kind}:${kind==='paid'?'settled':3}`,revision:3,payload:{bookingId:id,service:'bfm',...extra}});
 return {api:context.exports,env,calls,client,row,setBooking:b=>{booking=b;},setHistory:h=>{history=h;},setEmail:e=>{accountEmail=e;}};
}
test('five supported events produce bounded plain text with fixed HTTPS route and Moscow time',async()=>{
 const f=setup();
 for(const kind of ['created','confirmed','rescheduled','cancelled','paid']){
  f.setBooking({...book,status:kind==='created'?'pending':kind==='cancelled'?'cancelled':'confirmed'});
  const result=await f.api.resolveAdminMaxBooking(f.client,f.row(kind,{oldTime:'2026-10-17T10:00:00Z',newTime:book.slot_time}));
  assert(!!result?.message,'valid event rejected');const text=result.message.text;
  assert(text.includes('18.10.2026')&&text.includes('14:30 (МСК)'),'Moscow formatting missing');
  assert(text.includes('https://body-state.ru/admin/bookings?booking='+id),'fixed link missing');
  assert(text.length<3500&&!text.includes('999999'),'price snapshot must not masquerade as paid amount');
  assert(text.includes('+79000000000'),'phone normalization missing');
 }
});
test('single contacts, missing contacts, sanitation and hostile URLs never replace authoritative link',()=>{
 const f=setup();
 for(const contacts of [{client_phone:null},{client_email:null},{client_phone:null,client_email:null}]){
  const text=f.api.formatAdminMaxBooking({kind:'confirmed',bookingId:id,service:'bfm',booking:{...book,...contacts}}).text;
  assert(text.includes('Не указан'),'missing contact label absent');
 }
 const text=f.api.formatAdminMaxBooking({kind:'confirmed',bookingId:id,service:'bfm',booking:{...book,client_name:'Тест\n\u202ehttps://evil.invalid/x\n<script>',client_phone:'+79000000000\nInjected',client_email:'x@example.invalid\r\nInjected'}}).text;
 assert(!text.includes('https://evil.invalid')&&!text.includes('\u202e')&&!text.includes('<script>'),'unsafe field syntax retained');
 assert((text.match(/https:\/\//g)||[]).length===1,'untrusted URL admitted');
});
test('long fields remain bounded and missing snapshot uses per-service catalogue',()=>{
 const f=setup();for(const service of ['bfm','brt','psychology']){
  const message=f.api.formatAdminMaxBooking({kind:'confirmed',bookingId:id,service,booking:{...book,client_name:'Я'.repeat(10000),journey_snapshot:null}});
  assert(!!message&&message.text.length<3500,'text budget exceeded');
 }
});
test('runtime gate is OFF by default; requires admin-only and valid separate activation boundary',()=>{
 const f=setup(),created=new Date();assert(f.api.adminMaxDetailsEnabled(created));
 for(const key of ['NOTIFICATIONS_MAX_V1_ENABLED','NOTIFICATIONS_MAX_V1_ADMIN_ONLY','NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED']){
  const old=f.env[key];delete f.env[key];assert(!f.api.adminMaxDetailsEnabled(created));f.env[key]=old;
 }
 for(const stamp of ['', 'invalid', '2026-01-01T00:00:00', new Date(Date.now()+60000).toISOString()]){
  f.env.NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE=stamp;assert(!f.api.adminMaxDetailsEnabled(created));
 }
 f.env.NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE='2026-01-01T00:00:00Z';assert(!f.api.adminMaxDetailsEnabled(new Date('2025-12-31T23:59:59Z')));
});
test('forged service, UUID, event identity and revision fail before any booking lookup',async()=>{
 for(const mutate of [r=>r.payload.service='bfm;DROP TABLE orders',r=>r.payload.bookingId='invalid',r=>r.payload.bookingId=account,r=>r.event_type='reset_requested',r=>r.revision=-1,r=>r.event_key='forged']){
  const f=setup(),r=f.row();mutate(r);const result=await f.api.resolveAdminMaxBooking(f.client,r);
  assert(result?.rejected==='admin_event_invalid','forgery not classified');assert(f.calls.length===0,'forged input reached lookup');
 }
});
test('missing booking is retained for review and obsolete revision is not dispatched',async()=>{
 const f=setup();f.setBooking(null);assert((await f.api.resolveAdminMaxBooking(f.client,f.row()))?.rejected==='admin_booking_unavailable');
 f.setBooking({...book,notification_revision:4});assert((await f.api.resolveAdminMaxBooking(f.client,f.row()))===null);
 assert((await f.api.resolveAdminMaxBooking(f.client,f.row('paid')))?.rejected==='admin_event_invalid');
});
test('reschedule old/new time must match latest immutable event and current slot',async()=>{
 const f=setup(),r=f.row('rescheduled',{oldTime:'2026-10-17T10:00:00Z',newTime:book.slot_time});
 assert(!!(await f.api.resolveAdminMaxBooking(f.client,r))?.message);
 f.setHistory(null);assert(!!(await f.api.resolveAdminMaxBooking(f.client,r))?.rejected);
 f.setHistory({old_time:'2026-10-15T10:00:00Z',new_time:book.slot_time});assert(!!(await f.api.resolveAdminMaxBooking(f.client,r))?.rejected);
 assert(!!(await f.api.resolveAdminMaxBooking(f.client,f.row('rescheduled',{oldTime:'2026-10-17T10:00:00'})))?.rejected);
});
test('account email fallback uses same transaction, verified active linked account only',async()=>{
 const f=setup();f.setBooking({...book,client_email:null,account_user_id:account});
 const result=await f.api.resolveAdminMaxBooking(f.client,f.row());assert(!!result?.message);
 assert(result.message.text.includes('verified@example.invalid'),'verified fallback absent');
 assert(f.calls.some(c=>typeof c[0]==='string'&&c[0].includes('verified_at IS NOT NULL')&&c[1][0]===account),'unsafe account lookup');
 f.setEmail(null);assert((await f.api.resolveAdminMaxBooking(f.client,f.row())).message.text.includes('Не указан'));
});
test('status contradictions and unconfirmed payment do not fabricate booking or payment facts',async()=>{
 const f=setup();f.setBooking({...book,status:'cancelled'});assert((await f.api.resolveAdminMaxBooking(f.client,f.row()))===null);
 f.setBooking({...book,payment_status:'pending'});assert(!!(await f.api.resolveAdminMaxBooking(f.client,f.row('paid')))?.rejected);
 f.setBooking({...book,slot_time:'not-a-time'});assert(!!(await f.api.resolveAdminMaxBooking(f.client,f.row()))?.rejected);
});
test('formatter never includes clinical notes, secrets or delivery address',()=>{
 const f=setup();const message=f.api.formatAdminMaxBooking({kind:'paid',bookingId:id,service:'bfm',booking:{...book,notes:'FORBIDDEN_NOTE',diagnosis:'FORBIDDEN_DIAGNOSIS',passport:'FORBIDDEN_PASSPORT',access_token_hash:'FORBIDDEN_TOKEN',address:'FORBIDDEN_ADDRESS'}});
 assert(!!message&&!message.text.includes('FORBIDDEN_'),'non-allowlisted fields exposed');
});
test('production ENV contract rejects incomplete details opt-in without touching legacy Email configuration',()=>{
 const {spawnSync}=require('node:child_process');
 const env={PATH:process.env.PATH,NODE_ENV:'production',DATABASE_URL:'postgres://synthetic:synthetic@127.0.0.1/synthetic',REDIS_URL:'redis://127.0.0.1',ADMIN_USERNAME:'synthetic',ADMIN_PASSWORD_HASH:'$2b$12$'+'a'.repeat(53),CRON_SECRET:'s'.repeat(40),NEXT_PUBLIC_OPERATOR_OGRNIP:'0'.repeat(15),NEXT_PUBLIC_OPERATOR_ADDRESS:'Synthetic address',NEXT_PUBLIC_SITE_URL:'https://body-state.ru',NOTIFICATIONS_EMAIL_V1_ENABLED:'false',NOTIFICATIONS_MAX_V1_ENABLED:'true',NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'true',NOTIFICATIONS_MAX_V1_ACTIVE_SINCE:'2026-01-01T00:00:00Z',MAX_BOT_TOKEN:'synthetic',MAX_WEBHOOK_SECRET:'s'.repeat(40),MAX_BOT_URL:'https://max.ru/synthetic_bot'};
 const check=extra=>spawnSync(process.execPath,['scripts/validate-production-env.mjs'],{env:{...env,...extra},encoding:'utf8'}).status;
 assert(check({})===0,'existing runtime contract regressed');
 assert(check({NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED:'true'})!==0,'missing boundary admitted');
 const enable={NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED:'true',NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE:'2026-01-01T00:00:00Z'};
 assert(check(enable)===0,'complete opt-in rejected');
 assert(check({...enable,NOTIFICATIONS_MAX_V1_ADMIN_ONLY:'false'})!==0,'client rollout admitted');
 assert(check({...enable,NOTIFICATIONS_MAX_V1_ENABLED:'false'})!==0,'inactive MAX admitted');
 assert(check({...enable,NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE:'invalid'})!==0,'invalid boundary admitted');
 assert(check({...enable,NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED:'TRUE'})!==0,'non-strict opt-in admitted');
});
