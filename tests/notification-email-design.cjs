// Offline design/security contracts; never load transport or real credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const {parseDocument}=require('htmlparser2');
const fixtures=require('./fixtures/notification-email-design.cjs');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/notification-templates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,URL,Date,Intl});
const snapshots={};
for(const sample of fixtures){
 const email=exportsObject.notificationTemplate(sample.kind,sample.data),doc=parseDocument(email.html);
 const nodes=[];function walk(node){nodes.push(node);for(const child of node.children||[])walk(child);}walk(doc);
 assert(email.html.includes('name="viewport"'));assert(email.html.includes('BODY STATE'));
 assert(!/<(?:script|form|input|iframe|link|svg|video)\b/i.test(email.html));
 assert(!/@import|url\(|display\s*:\s*(grid|flex)|javascript:/i.test(email.html));
 assert(nodes.some(n=>n.name==='table'&&n.attribs.role==='presentation'));
 assert.equal(nodes.filter(n=>n.name==='h1').length,1);
 for(const node of nodes){
  for(const name of Object.keys(node.attribs||{}))assert(!/^on/i.test(name),'inline event handler');
  if(node.name==='a')assert.equal(new URL(node.attribs.href).origin,'https://body-state.ru');
  if(node.name==='img'){assert.equal(node.attribs.src,'https://body-state.ru/admin-icons/192.png');assert(node.attribs.alt);assert(node.attribs.width);assert(node.attribs.height);}
 }
 const stripped=email.html.replace(/<img\b[^>]*>/gi,'');assert(stripped.includes('BODY STATE'));assert(stripped.includes(sample.title));
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
if(process.argv.includes('--update'))fs.writeFileSync(snapshotFile,JSON.stringify(snapshots,null,2)+'\n');
assert.deepEqual(snapshots,JSON.parse(fs.readFileSync(snapshotFile,'utf8')));
console.log('PASS 5 email HTML/text snapshots; table-only safe rendering, links, images-off content, TTL and honest payment data');
