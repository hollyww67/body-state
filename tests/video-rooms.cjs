// Integration tests with the isolated PostgreSQL + Redis, never production.
const assert=require('node:assert/strict');
const path=require('node:path');
const Module=require('node:module');
process.loadEnvFile(path.resolve(__dirname,'../.env.journey-qa.example'));
if(!process.env.DATABASE_URL.includes('127.0.0.1:15432/audit_regression_'))throw new Error('QA database required');
process.env.TURN_SECRET='synthetic-video-test-secret';
process.env.TURN_URLS='turn:127.0.0.1:3478?transport=udp';
const base=path.resolve(__dirname,'../artifacts/audit-runtime/src');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.join(base,id.slice(2)):id,...args);};
const {NextRequest}=require('next/server');
const {pool}=require(path.join(base,'lib/db.js'));
const {getRedis,cacheDelete}=require(path.join(base,'lib/redis.js'));
const {createAdminSessionToken}=require(path.join(base,'lib/admin-auth.js'));
const {createAccountSession}=require(path.join(base,'lib/account-auth.js'));
const check=require(path.join(base,'app/api/room/check/route.js'));
const signal=require(path.join(base,'app/api/room/signal/route.js'));
const rooms=require(path.join(base,'app/api/psychology/rooms/route.js'));
const {randomUUID}=require('node:crypto');
let room,user,other,adminToken,userToken,otherToken,slot,booking;
let passed=0;
function req(id,cookie,method='GET',body,session=''){
 return new NextRequest('http://localhost:3100/api/room/signal?id='+id+(session?'&session='+session:''),{method,headers:{cookie:cookie||'',origin:'http://localhost:3100','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
}
async function expect(response,status,label){assert.equal(response.status,status,label);passed++;return response.json();}
(async()=>{
 user=(await pool.query("INSERT INTO account_users(username,email,display_name,password_hash,consent_version,consent_at,verified_at) VALUES($1,$1,'Video QA','unused','qa',now(),now()) RETURNING id",['video-'+randomUUID()+'@example.test'])).rows[0].id;
 other=(await pool.query("INSERT INTO account_users(username,email,display_name,password_hash,consent_version,consent_at,verified_at) VALUES($1,$1,'Other QA','unused','qa',now(),now()) RETURNING id",['video-'+randomUUID()+'@example.test'])).rows[0].id;
 adminToken=await createAdminSessionToken();userToken=await createAccountSession(user);otherToken=await createAccountSession(other);
 const admin='admin_session='+adminToken,client='account_session='+userToken,stranger='account_session='+otherToken;
 room=randomUUID();
 await pool.query("INSERT INTO psychology_rooms(room_id,room_name,created_by,meeting_url,account_user_id,expires_at) VALUES($1,'QA','QA','/psychology/room',$2,now()+interval '1 hour')",[room,user]);
 await expect(await check.GET(req(room)),401,'anonymous denied');
 await expect(await check.GET(req(room,stranger)),404,'other client denied');
 await expect(await check.GET(req(room,client)),200,'owner allowed');
 const a=await expect(await signal.POST(req(room,admin,'POST',{type:'join'})),200,'doctor joins');
 const b=await expect(await signal.POST(req(room,client,'POST',{type:'join'})),200,'client joins');
 assert.equal(a.role,'doctor');assert.equal(b.role,'client');assert.ok(a.iceServers[0].credential);
 await expect(await signal.POST(req(room,client,'POST',{type:'join'})),409,'duplicate participant denied');
 await expect(await signal.POST(req(room,client,'POST',{type:'offer',session:b.session,peer:a.session,data:{type:'offer',sdp:'test'}})),403,'client cannot impersonate doctor');
 await expect(await signal.GET(req(room,stranger,'GET',null,a.session)),404,'stranger cannot read signals');
 await Promise.all(Array.from({length:15},(_,i)=>signal.POST(req(room,admin,'POST',{type:'ice',session:a.session,peer:b.session,data:{candidate:'candidate:'+i}})).then(r=>expect(r,200,'parallel candidate'))));
 const polled=await expect(await signal.GET(req(room,client,'GET',null,b.session)),200,'read candidates');
 assert.equal(polled.messages.length,15,'no messages lost under parallel writes');
 assert.equal((await (await signal.GET(req(room,client,'GET',null,b.session))).json()).messages.length,15,'reads are non-destructive');
 await expect(await signal.DELETE(req(room,client,'DELETE',null,b.session)),200,'leave');
 await expect(await signal.POST(req(room,admin,'POST',{type:'ice',session:a.session,peer:b.session,data:{candidate:'stale'}})),409,'stale peer rejected');
 const c=await expect(await signal.POST(req(room,client,'POST',{type:'join'})),200,'rejoin');assert.notEqual(c.session,b.session);
 await expect(await signal.GET(req(room,client,'GET',null,b.session)),409,'old session rejected');
 await pool.query('UPDATE psychology_rooms SET is_active=false WHERE room_id=$1',[room]);
 await expect(await signal.GET(req(room,client,'GET',null,c.session)),410,'room revocation stops active session');
 await pool.query("UPDATE psychology_rooms SET is_active=true,expires_at=now()-interval '1 second' WHERE room_id=$1",[room]);
 await expect(await check.GET(req(room,client)),410,'expired denied');
 await expect(await rooms.POST(req(room,admin,'POST',{room_name:'QA',email:'missing@example.test'})),400,'unknown client cannot get room');
 const bookingRoom=randomUUID();
 slot=(await pool.query("INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES('psychology',now()+interval '2 days',90) RETURNING id")).rows[0].id;
 booking=(await pool.query("INSERT INTO psychology_bookings(slot_id,client_name,client_phone,booking_type,room_id,status,payment_status,account_user_id) VALUES($1,'QA','+79990000000','online',$2,'confirmed','paid',$3) RETURNING id",[slot,bookingRoom,user])).rows[0].id;
 await expect(await check.GET(req(bookingRoom,client)),403,'too early denied');
 await pool.query('UPDATE slots SET slot_time=now() WHERE id=$1',[slot]);
 await expect(await check.GET(req(bookingRoom,client)),200,'paid appointment at scheduled time allowed');
 await pool.query("UPDATE psychology_bookings SET payment_status='pending' WHERE id=$1",[booking]);
 await expect(await check.GET(req(bookingRoom,client)),410,'unpaid appointment denied');
 await pool.query("UPDATE psychology_bookings SET payment_status='paid',status='cancelled' WHERE id=$1",[booking]);
 await expect(await check.GET(req(bookingRoom,client)),410,'cancelled appointment denied');
 await pool.query("UPDATE psychology_bookings SET status='confirmed' WHERE id=$1",[booking]);
 await pool.query("UPDATE slots SET slot_time=now()+interval '2 days' WHERE id=$1",[slot]);
 await expect(await check.GET(req(bookingRoom,client)),403,'rescheduled appointment immediately changes access');
 console.log('PASS '+passed+' video integration checks; auth, concurrency, revocation, rejoin, expiry.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(room){await pool.query('DELETE FROM psychology_rooms WHERE room_id=$1',[room]);const redis=await getRedis();if(redis){const keys=await redis.keys('video:*'+room+'*');if(keys.length)await redis.del(keys);}}
 if(booking)await pool.query('DELETE FROM psychology_bookings WHERE id=$1',[booking]);
 if(slot)await pool.query('DELETE FROM slots WHERE id=$1',[slot]);
 for(const token of [adminToken])if(token)await cacheDelete('admin-session:'+token);
 for(const token of [userToken,otherToken])if(token)await cacheDelete('account-session:'+token);
 for(const id of [user,other])if(id)await pool.query('DELETE FROM account_users WHERE id=$1',[id]);
 await pool.end();const redis=await getRedis();if(redis)await redis.quit();
});
