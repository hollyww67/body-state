// Deterministic local rendering only. Does not import core, DB, SMTP or runtime ENV.
const fs=require('node:fs'),path=require('node:path');
const {parseDocument}=require('htmlparser2');
function escapePreviewText(value) {
 return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function withoutImages(html) {
 // Replace exact ranges backwards, preserving inline email markup/Outlook comments.
 const document=parseDocument(html,{withStartIndices:true,withEndIndices:true});
 const images=[];
 function walk(node){if(node.name==='img')images.push(node);for(const child of node.children||[])walk(child);}
 walk(document);
 let output=html;
 for(const node of images.sort((a,b)=>b.startIndex-a.startIndex)){
  const alt=(node.attribs.alt||'').trim();
  const replacement=alt?'<span style="font-size:11px;color:#526760;overflow-wrap:anywhere">'+escapePreviewText(alt)+'</span>':'';
  output=output.slice(0,node.startIndex)+replacement+output.slice(node.endIndex+1);
 }
 return output;
}
const root=path.resolve(__dirname,'..');
function generatePreviews(){
const fixtures=require('../tests/fixtures/notification-email-design.cjs');
const exportsObject=require('../tests/fixtures/load-email-templates.cjs')();
const output=path.join(root,'artifacts/notification-email-design');fs.mkdirSync(output,{recursive:true});
for(const sample of fixtures){
 const result=sample.kind==='welcome'?exportsObject.accountCreatedEmailTemplate(sample.data.name):exportsObject.notificationTemplate(sample.kind,sample.data);
 fs.writeFileSync(path.join(output,sample.slug+'.html'),result.html);
 fs.writeFileSync(path.join(output,sample.slug+'.txt'),result.text);
 fs.writeFileSync(path.join(output,sample.slug+'-no-images.html'),withoutImages(result.html));
}
const longSample=fixtures.find(sample=>sample.slug==='booking-long');
const longAddress=exportsObject.notificationTemplate('confirmed',{...longSample.data,address:'Очень длинный синтетический адрес: '+('ТестовыйКорпусБезПерсональныхДанных').repeat(12)});
fs.writeFileSync(path.join(output,'booking-long-address.html'),longAddress.html);
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Body State — email previews</title><body style="margin:0;background:#F6F5F2;font:16px/1.6 Arial,sans-serif;color:#111827"><main style="max-width:1040px;margin:40px auto;padding:24px"><p style="color:#0F766E;letter-spacing:3px;font-weight:bold">BODY STATE</p><h1>Email previews</h1><p>Синтетические примеры. Никаких отправок. Ссылки восстановления недействующие.</p><p>Desktop/mobile browser render — не проверка настоящего Outlook, Apple Mail или Yandex Mail. Для inbox acceptance требуется отдельно разрешённый smoke.</p>${fixtures.map(sample=>`<section style="margin:24px 0;padding:24px;background:white;border:1px solid #E2E7E4;border-radius:16px"><h2 style="margin-top:0">${sample.title}</h2><p><a href="${sample.slug}.html" style="color:#0F766E">HTML preview</a> · <a href="${sample.slug}-no-images.html" style="color:#0F766E">Без картинок</a> · <a href="${sample.slug}.txt" style="color:#0F766E">Plain text</a></p><iframe title="${sample.title}" src="${sample.slug}.html" style="border:0;width:100%;height:930px;background:#F6F5F2"></iframe></section>`).join('')}<p>Payment preview показывает текущий V1 payload: сумма и дата платежа в него пока не передаются. Они не подменены временем отправки или ценой процедуры.</p></main></body></html>`);
console.log(`PASS generated ${fixtures.length} HTML/text/image-free previews; synthetic fixtures only; no sends`);
}
module.exports={withoutImages,generatePreviews};
if(require.main===module)generatePreviews();
