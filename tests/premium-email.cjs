// Presentation/security QA only; no sockets, DB, SMTP or real ENV.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {parseDocument}=require('htmlparser2');
const {withoutImages}=require('../scripts/preview-notification-emails.cjs');
const deny=()=>{throw Error('QA forbids network/SMTP sends');};
const blocked=[];
for(const [module,names] of [['node:net',['connect','createConnection']],['node:tls',['connect']],
 ['node:http',['request','get']],['node:https',['request','get']],['node:dns',['lookup','resolve']]]){
 const value=require(module);for(const name of names){blocked.push([value,name,value[name]]);value[name]=deny;}
}
const oldFetch=global.fetch;global.fetch=deny;
const socket=require('node:net').Socket.prototype;blocked.push([socket,'connect',socket.connect]);socket.connect=deny;
process.on('exit',()=>{for(const [value,name,original]of blocked)value[name]=original;global.fetch=oldFetch;});
const api=require('./fixtures/load-email-templates.cjs')();
const sample={name:'Захар',serviceTitle:'Физическая реабилитация',slotTime:'2026-10-20T11:00:00Z',durationMinutes:90,address:'Хотьково, Заводская 16'};
const main=api.notificationTemplate('confirmed',sample);
for(const value of ['Захар','Физическая реабилитация','20 октября 2026','14:00','90 минут','Хотьково, Заводская 16'])assert(main.html.includes(value)&&main.text.includes(value));
assert(main.html.includes('Вы успешно записаны'));assert(main.html.includes('Открыть запись'));
assert(!main.html.includes('Клиника'));assert(!main.html.includes('bory-state.ru'));assert(!main.html.includes('+7 (495)'));
assert(main.html.includes('at@body-state.ru'));assert(main.html.includes('+7 (926) 426-91-46'));
const bare=api.notificationTemplate('confirmed',{name:'Другой клиент',serviceTitle:'Другая услуга',slotTime:sample.slotTime});
assert(!bare.html.includes('90 минут'));assert(!bare.html.includes('Заводская'));
assert(!bare.html.includes('Захар'));assert(!bare.html.includes('Физическая реабилитация'));
for(const durationMinutes of [0,-1,NaN,Infinity,90.5,'90',2000])assert(!api.notificationTemplate('confirmed',{...sample,durationMinutes}).text.includes('Продолжительность'));
for(const key of ['name','serviceTitle','address']){
 const attack=api.notificationTemplate('confirmed',{...sample,[key]:'<img src=x onerror="alert(1)"> & data'});
 assert(!attack.html.includes('<img src=x'));assert(attack.html.includes('&lt;img'));assert(attack.html.includes('&amp; data'));
}
const cancelled=api.notificationTemplate('cancelled',sample);
// Optional fields never manufacture fixture facts or render undefined/null.
for(const absent of [undefined,null,'','   ']){
 const result=api.notificationTemplate('confirmed',{...sample,address:absent,durationMinutes:undefined});
 assert(!result.text.includes('Адрес:'));assert(!result.text.includes('Продолжительность:'));
 assert(!/\b(?:undefined|null|NaN)\b/.test(result.html));
}
for(const key of ['name','serviceTitle','address']){
 const value=('ОченьДлиннаяСтрока'+key).repeat(100)+' <&"\' конец';
 const result=api.notificationTemplate('confirmed',{...sample,[key]:value});
 assert(result.text.includes(value),'Plaintext preserves actual '+key);
 assert(result.html.includes('&lt;&amp;&quot;&#39; конец'),'HTML escapes all five delimiters '+key);
 assert(result.html.includes('overflow-wrap:anywhere'),'Long-string wrapping contract');
}
assert(main.text.includes('Открыть запись: https://body-state.ru/account'));
assert(!/<(?:html|table|img|a)\b/i.test(main.text),'Plaintext independent of HTML');
function nodesOf(html){const nodes=[];function walk(n){nodes.push(n);for(const c of n.children||[])walk(c);}walk(parseDocument(html));return nodes;}
const textOf=n=>n.type==='text'?n.data:(n.children||[]).map(textOf).join('');
for(const kind of ['created','confirmed','rescheduled','cancelled','paid','reminder_24h','reminder_2h']){
 const result=api.notificationTemplate(kind,{...sample,oldTime:sample.slotTime});
 const cta=nodesOf(result.html).filter(n=>n.name==='a'&&/Открыть запись|Посмотреть запись|Открыть кабинет|Мои записи/.test(textOf(n)));
 assert.equal(cta.length,1,kind+' has exactly one account CTA');
 assert.equal(cta[0].attribs.href,'https://body-state.ru/account',kind+' CTA is real account route');
 assert(result.text.includes('https://body-state.ru/account'));
 const imagesOff=withoutImages(result.html);
 assert(!nodesOf(imagesOff).some(n=>n.name==='img'));
 // paid intentionally has no appointment date/address in the current payload contract.
 const facts=kind==='paid'?['Физическая реабилитация']:['Физическая реабилитация','20 октября 2026','14:00','Хотьково, Заводская 16'];
 for(const fact of facts)assert(imagesOff.includes(fact),kind+' images-off keeps '+fact);
 assert(!imagesOff.includes('Логотип скрыт'));
}
// Static route/auth evidence only; no HTTP, DB or real session.
assert(fs.readFileSync('src/app/account/page.tsx','utf8').includes('<AccountClient'));
const account=fs.readFileSync('src/components/account/AccountClient.tsx','utf8');
assert(account.includes('fetch("/api/account", { cache: "no-store" })'));assert(account.includes('data.bookings'));
const route=fs.readFileSync('src/app/api/account/route.ts','utf8');
assert(route.includes('await getAccountSession(request)'));assert(route.includes('if (!session)'));
assert(route.includes('status: 401'));assert(route.includes('WHERE b.account_user_id=$1'));
assert(/ORDER BY created_at DESC[\s\S]*?\[session\.userId\]/.test(route),'Booking query bound to session');
// Meaningful alt stays escaped text; decorative, absent and whitespace alt disappear.
const raw='<!--[if mso]><table><![endif]--><p id="keep">Текст</p><img alt="" src="x"><img alt="  " src="y"><img src="z"><IMG ALT=\'&lt;svg onload=&quot;x&quot;&gt; &amp; &apos;значимый&apos;\' src="w">';
const noImages=withoutImages(raw),parsed=nodesOf(noImages);
assert(!parsed.some(n=>['img','svg','script'].includes(n.name)));
assert.equal(parsed.filter(n=>n.name==='span').length,1);
assert(noImages.includes('&lt;svg onload=&quot;x&quot;&gt; &amp; &#39;значимый&#39;'));
assert(noImages.includes('<!--[if mso]><table><![endif]-->'));assert(noImages.includes('<p id="keep">Текст</p>'));
assert.equal(withoutImages('<img alt="">'),'');assert.equal(withoutImages(noImages),noImages);
assert(withoutImages('<img src="x" alt=\'A > B &quot; C &amp; D\'>').includes('A &gt; B &quot; C &amp; D'),'Quoted greater-than must not truncate alt parsing');
assert.throws(deny,/forbids/);
assert(cancelled.html.includes('Открыть кабинет'));assert(!cancelled.html.includes('Открыть запись'));
const reset=api.passwordResetEmailTemplate('https://body-state.ru/account/reset-password?token=PREVIEW-NOT-A-REAL-TOKEN');
assert(reset.text.includes('30 минут'));assert(reset.text.includes('одноразовой'));assert(reset.text.includes('проигнорируйте'));
for(const resetUrl of ['https://body-state.ru@evil.invalid/reset','http://body-state.ru/reset','javascript:alert(1)'])assert.throws(()=>api.passwordResetEmailTemplate(resetUrl));
// Prove MAX-facing subjects and special admin text remain baseline-exact.
const titles={created:'Заявка на запись получена',confirmed:'Запись подтверждена',rescheduled:'Запись перенесена',cancelled:'Запись отменена',paid:'Оплата подтверждена',reminder_24h:'Напоминание: запись через 24 часа',reminder_2h:'Напоминание: запись через 2 часа'};
for(const [kind,title] of Object.entries(titles))assert.equal(api.notificationTemplate(kind,{...sample,oldTime:sample.slotTime}).subject,'Body State — '+title);
const src=fs.readFileSync('src/lib/notification-core.ts','utf8');
assert(src.includes("if(row.channel==='email'&&booking)"));
const base='da70cc314788abb61188dee66d472daca65091cb';
const original=cp.execFileSync('git',['show',base+':src/lib/appointment-notifications.ts'],{encoding:'utf8'});
const current=fs.readFileSync('src/lib/appointment-notifications.ts','utf8');
for(const name of ['confirmed','titles','date','payment','text']){
 const line=original.split('\n').find(l=>l.includes('const '+name+'='));assert(line,'SMS baseline line '+name);assert(current.replaceAll('\r','').includes(line.replaceAll('\r','')),'Legacy/SMS expression unchanged '+name);
}
for(const file of ['src/lib/notification-scheduler.ts','src/lib/notification-smtp-budget.ts','src/lib/max-notifications.ts','src/lib/max-rollout.ts']){
 const old=cp.execFileSync('git',['show',base+':'+file],{encoding:'utf8'}).replaceAll('\r','');assert.equal(fs.readFileSync(file,'utf8').replaceAll('\r',''),old,file+' unchanged');
}
console.log('PASS premium email: personalization, optional facts, injection, contacts, CTA, reset safety, MAX subjects, legacy SMS and scheduler/budget contracts');
