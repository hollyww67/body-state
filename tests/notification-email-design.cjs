// Offline design/security contracts; never load transport or real credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const deny=()=>{throw Error('Offline email QA forbids network/SMTP');};
const originals=[];
for(const [module,names]of [['node:net',['connect','createConnection']],['node:tls',['connect']],
 ['node:http',['request','get']],['node:https',['request','get']],['node:dns',['lookup','resolve']]]){
 const target=require(module);for(const name of names){originals.push([target,name,target[name]]);target[name]=deny;}
}
const socket=require('node:net').Socket.prototype;originals.push([socket,'connect',socket.connect]);socket.connect=deny;
const oldFetch=global.fetch;global.fetch=deny;
process.on('exit',()=>{for(const [target,name,original]of originals)target[name]=original;global.fetch=oldFetch;});
// Importing the preview transform must never generate files as a side effect.
const originalWrite=fs.writeFileSync,originalMkdir=fs.mkdirSync;
let withoutImages;
try{
 fs.writeFileSync=()=>{throw Error('Unexpected preview file write on import');};
 fs.mkdirSync=()=>{throw Error('Unexpected preview directory write on import');};
 ({withoutImages}=require('../scripts/preview-notification-emails.cjs'));
}finally{fs.writeFileSync=originalWrite;fs.mkdirSync=originalMkdir;}
const {parseDocument}=require('htmlparser2');
const fixtures=require('./fixtures/notification-email-design.cjs');
const exportsObject=require('./fixtures/load-email-templates.cjs')();
const snapshots={};
for(const sample of fixtures){
 const email=sample.kind==='welcome'?exportsObject.accountCreatedEmailTemplate(sample.data.name):exportsObject.notificationTemplate(sample.kind,sample.data),doc=parseDocument(email.html);
 const nodes=[];function walk(node){nodes.push(node);for(const child of node.children||[])walk(child);}walk(doc);
 assert(email.html.includes('name="viewport"'));assert(email.html.includes('Body State'));
 assert(!/<(?:script|form|input|iframe|link|svg|video)\b/i.test(email.html));
 assert(!/@import|url\(|display\s*:\s*(grid|flex)|javascript:/i.test(email.html));
 assert(nodes.some(n=>n.name==='table'&&n.attribs.role==='presentation'));
 assert.equal(nodes.filter(n=>n.name==='h1').length,1);
 for(const node of nodes){
  for(const name of Object.keys(node.attribs||{}))assert(!/^on/i.test(name),'inline event handler');
  if(node.name==='a'){const u=new URL(node.attribs.href);if(u.protocol==='https:')assert.equal(u.origin,'https://body-state.ru');else assert(['tel:+79264269146','mailto:at@body-state.ru'].includes(node.attribs.href));}
  if(node.name==='img'){assert(/^https:\/\/body-state\.ru\/email-assets\/(brand-illustration|botanical|service|calendar|clock|location|phone|mail|arrow)\.png$/.test(node.attribs.src));assert('alt' in node.attribs);assert(node.attribs.width);assert(node.attribs.height);}
 }
 const stripped=withoutImages(email.html);assert(stripped.includes('Body State'));assert(stripped.includes(sample.title));
 const without=parseDocument(stripped),noImageNodes=[];function collect(n){noImageNodes.push(n);for(const c of n.children||[])collect(c);}collect(without);
 assert(!noImageNodes.some(n=>n.name==='img'));assert(!stripped.includes('Логотип скрыт'));
 // Every original text node and link survives; image alternates are additional escaped text.
 const textContent=n=>n.type==='text'?n.data:(n.children||[]).map(textContent).join('');
 for(const node of nodes.filter(n=>n.type==='text'&&n.data.trim()))assert(stripped.includes(node.data)||textContent(without).includes(node.data),'Images-off retains original text');
 const links=list=>list.filter(n=>n.name==='a').map(n=>n.attribs.href);
 assert.deepEqual(links(noImageNodes),links(nodes),'Images-off keeps working link destinations');
 for(const img of nodes.filter(n=>n.name==='img'&&n.attribs.alt?.trim()))assert(textContent(without).includes(img.attribs.alt.trim()),'Meaningful alt survives');
 assert(email.text.includes(sample.title));assert(email.text.includes('https://body-state.ru'));
 assert(email.html.length<50000,'avoid email clipping/large markup');
 snapshots[sample.slug]={html:crypto.createHash('sha256').update(email.html).digest('hex'),text:crypto.createHash('sha256').update(email.text).digest('hex')};
}
const reset=exportsObject.notificationTemplate('reset_requested',fixtures[0].data);
assert(reset.text.includes('30'));assert(reset.text.includes('Сбросить пароль'));assert(reset.text.includes('игнор'));
const paid=exportsObject.notificationTemplate('paid',fixtures[4].data);
assert(paid.text.includes('не фискальный чек'));assert(!paid.text.includes('2026'),'do not invent payment timestamp');
const admin=exportsObject.notificationTemplate('delivery_alert',{accountUrl:'https://body-state.ru/admin/notifications'});
assert.equal(admin.text,['Body State','Требуется проверка уведомлений','Достигнут порог ошибок отправки. Проверьте состояние уведомлений в административном кабинете.','Открыть кабинет: https://body-state.ru/admin/notifications','https://body-state.ru'].join('\n\n'),'MAX admin plain-text remains byte-identical');
const richPayment=exportsObject.notificationTemplate('paid',{...fixtures[4].data,amount:3500,paidAt:'2026-10-15T18:00:00Z'});
assert(richPayment.text.includes('3\u00a0500'));assert(richPayment.text.includes('15 октября 2026'));assert(richPayment.text.includes('21:00'));
const snapshotFile=path.join(__dirname,'fixtures/notification-email-design.snapshots.json');
const expectedSnapshots=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));
for(const [slug,values]of Object.entries(snapshots))assert.equal(values.text,expectedSnapshots[slug]?.text,slug+' plaintext snapshot unchanged');
// Explicitly approve only the reviewed HTML drift; plaintext remains immutable above.
if(process.argv.includes('--update'))fs.writeFileSync(snapshotFile,JSON.stringify(snapshots,null,2)+'\n');
if(process.argv.includes('--contracts-only')){
 console.log('NOT TESTED HTML snapshot equality (--contracts-only); plaintext snapshots VERIFIED; snapshot file unchanged');
}else assert.deepEqual(snapshots,JSON.parse(fs.readFileSync(snapshotFile,'utf8')));
console.log(`PASS ${fixtures.length} email ${process.argv.includes('--contracts-only')?'render contracts + plaintext snapshots (HTML snapshots NOT TESTED)':'HTML/text snapshots and render contracts'}; table-only safe rendering, links, images-off content, TTL and honest payment data`);
