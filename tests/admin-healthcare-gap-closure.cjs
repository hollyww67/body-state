// Stage 3.1 offline contracts: no providers, database, application imports or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const base = '83c353c38249bcab310ea7931e5f1fb76bd7ab15';
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe']});
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const before = file => git('show',`${base}:${file}`);
const parse = text => { const sf=ts.createSourceFile('contract.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX); assert.equal(sf.parseDiagnostics.length,0); return sf; };
function walk(n,fn) { fn(n); ts.forEachChild(n,c=>walk(c,fn)); }
function shape(n) { const children=[]; ts.forEachChild(n,c=>{children.push(shape(c));}); return [ts.SyntaxKind[n.kind],!ts.isSourceFile(n)&&typeof n.text==='string'?n.text:null,...children]; }
const canon = n => JSON.stringify(shape(n));
function collect(sf,predicate) { const found=[]; walk(sf,n=>{if(predicate(n))found.push(n);}); return found; }
const attrs = n => n.attributes.properties.filter(ts.isJsxAttribute);
const attr = (n,key) => attrs(n).find(a=>a.name.getText()===key);
const openings = sf => collect(sf,n=>ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n));
const bookingsFile='src/app/admin/bookings/page.tsx';
const expr = text => parse(`const value = (${text});`).statements[0].declarationList.declarations[0].initializer.expression;
function bookingCreateClose(sf) {
  const matches=openings(sf).filter(n=>n.tagName.getText()==='AdminModal'&&attr(n,'title')?.initializer?.text==='Новая запись');
  assert.equal(matches.length,1,'Exactly one booking creation modal');
  const modalNode=matches[0];
  const buttons=openings(modalNode.parent).filter(n=>n.tagName.getText()==='AdminButton'&&attr(n,'aria-label')?.initializer?.text==='Закрыть форму новой записи');
  assert.equal(buttons.length,1,'Exactly one internal creation close control');
  return {modalNode,button:buttons[0]};
}
function assertBookingCreateBusy(sf) {
  const result=bookingCreateClose(sf);
  assert.equal(attr(result.modalNode,'presentation')?.initializer?.text,'panel');
  for(const [node,key] of [[result.modalNode,'dismissDisabled'],[result.button,'disabled']]) {
    const properties=attrs(node).filter(a=>a.name.getText()===key);assert.equal(properties.length,1,key);
    assert.equal(canon(properties[0].initializer.expression),canon(expr('adding')),key);
  }
  for(const [node,key] of [[result.modalNode,'onCancel'],[result.button,'onClick']])assert.equal(canon(attr(node,key).initializer.expression),canon(expr('() => setShowAddForm(false)')));
  return result;
}
let passed=0,failed=0;
async function test(name,fn) { try { await fn(); passed++; console.log(`VERIFIED ${name}`); } catch(e) { failed++; console.error(`BLOCKED ${name}: ${e.message}`); } }
function loadModal(text) {
  const states=[],exports={}; const jsx=(type,props)=>({type,props});
  const mocks={react:{useEffect:()=>{},useId:()=> 'qa-id',useRef:current=>({current}),useState:v=>[v,x=>states.push(x)]},'react-dom':{createPortal:v=>v},'react/jsx-runtime':{jsx,jsxs:jsx}};
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:key=>{assert(Object.hasOwn(mocks,key),`Unmocked dependency ${key}`);return mocks[key];},document:{body:{}},Error},{timeout:1000});
  return {exports,states};
}
function nodes(tree) { if(Array.isArray(tree))return tree.flatMap(nodes); if(!tree||typeof tree!=='object')return [];return [tree,...nodes(tree.props?.children)]; }
const modal='src/components/admin/AdminConfirmDialog.tsx';
(async()=>{
await test('fixed base and branch; tracked and untracked runtime boundaries',()=>{
  assert.equal(git('branch','--show-current').trim(),'feat/admin-healthcare-gap-closure');
  git('rev-parse','--verify',`${base}^{commit}`);
  const allowed=new Set(['src/app/admin/bookings/page.tsx','src/app/admin/calendar/page.tsx',modal,'src/app/admin/healthcare-calendar.css','src/app/admin/healthcare-dashboard.css','src/app/admin/healthcare-shell.css','src/app/admin/dashboard/page.tsx','src/components/admin/AdminToday.tsx']);
  const files=[...git('diff','--name-only','-z',base).split('\0'),...git('ls-files','--others','--exclude-standard','-z').split('\0')].filter(Boolean);
  assert.deepEqual(files.filter(f=>!allowed.has(f)&&!f.startsWith('tests/')&&!/^(docs\/|[^/]+\.md$)/.test(f)),[],'Backend/lib/API/schema/auth/payment/config content must remain base-exact');
});
for(const file of ['src/app/admin/bookings/page.tsx','src/app/admin/calendar/page.tsx']) {
await test(`${file}: every baseline function body, mutation and request unchanged`,()=>{
  const a=parse(before(file)),b=parse(read(file));
  const functions=sf=>collect(sf,n=>(ts.isVariableDeclaration(n)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))||ts.isFunctionDeclaration(n)).filter(n=>n.name&&n.name.getText()!=='AdminBookingsPage'&&n.name.getText()!=='AdminCalendarPage');
  for(const n of functions(a)) { const match=functions(b).filter(x=>x.name.getText()===n.name.getText());assert.equal(match.length,1,n.name.getText());assert.equal(canon(match[0]),canon(n),n.name.getText()); }
  const requests=sf=>collect(sf,n=>ts.isCallExpression(n)&&n.expression.getText()==='fetch').map(canon).sort();
  assert.deepEqual(requests(b),requests(a),'All fetch URLs, options and payloads');
});
await test(`${file}: input identity/consent and form submit bindings retain exact AST`,()=>{
  const a=parse(before(file)),b=parse(read(file));
  const controls=sf=>openings(sf).filter(n=>['input','AdminInput','AdminSelect','SchedulingClientPicker','form'].includes(n.tagName.getText()));
  const contract=n=>JSON.stringify([n.tagName.getText(),attrs(n).filter(a=>!['className','style'].includes(a.name.getText())).map(canon)]);
  const remaining=controls(b).map(contract);
  for(const n of controls(a)) { const i=remaining.indexOf(contract(n));assert(i>=0,`Lost/changed ${n.tagName.getText()} ${attr(n,'id')?.getText()||attr(n,'checked')?.getText()||''}`);remaining.splice(i,1); }
});
await test(`${file}: existing action handlers retain associated disabled/loading guards`,()=>{
  const contract=n=>JSON.stringify(attrs(n).filter(a=>['onClick','disabled','loading','type'].includes(a.name.getText())).map(canon));
  const controls=sf=>openings(sf).filter(n=>['button','AdminButton'].includes(n.tagName.getText())&&attr(n,'onClick'));
  const current=parse(read(file));
  const remaining=controls(current).map(contract);
  const createBefore=file===bookingsFile?bookingCreateClose(parse(before(file))):null;
  const createAfter=file===bookingsFile?assertBookingCreateBusy(current):null;
  if(createBefore) {
    assert.equal(attr(createBefore.button,'disabled'),undefined,'Baseline internal close had no busy guard');
    assert.equal(attr(createBefore.modalNode,'dismissDisabled'),undefined,'Baseline modal had no busy dismiss guard');
  }
  for(const n of controls(parse(before(file)))) {
    // The replaced details close control now has a busy guard and a new back label.
    if(attr(n,'aria-label')?.initializer?.text==='Закрыть карточку')continue;
    if(createBefore&&attr(n,'aria-label')?.initializer?.text==='Закрыть форму новой записи') {
      // Only this control may gain exactly disabled={adding}; all other action attrs stay exact.
      const stripped=JSON.stringify(attrs(createAfter.button).filter(a=>['onClick','loading','type'].includes(a.name.getText())).map(canon));
      assert.equal(stripped,contract(n));
      const i=remaining.indexOf(contract(createAfter.button));assert(i>=0);remaining.splice(i,1);continue;
    }
    const i=remaining.indexOf(contract(n));assert(i>=0,`Changed action guard: ${attr(n,'onClick').getText()}`);remaining.splice(i,1);
  }
});
}
await test('booking creation: both close mechanisms blocked while adding; guard removal detected',()=>{
  const sf=parse(read(bookingsFile));const {modalNode,button}=assertBookingCreateBusy(sf);
  const evaluate=(node,key,adding,onClose)=>vm.runInNewContext(`(${attr(node,key).initializer.expression.getText(sf)})`,{adding,setShowAddForm:onClose},{timeout:1000});
  for(const adding of [false,true]) {
    let closed=0;const onClose=value=>{assert.equal(value,false);closed++;};
    const dismissDisabled=evaluate(modalNode,'dismissDisabled',adding,onClose);
    const wrapper=loadModal(read(modal)).exports;
    const tree=wrapper.default({title:'Новая запись',presentation:'panel',dismissDisabled,onCancel:evaluate(modalNode,'onCancel',adding,onClose)});
    tree.props.onCancel({preventDefault(){}});assert.equal(closed,adding?0:1,'Native cancel/Escape');
    const disabled=evaluate(button,'disabled',adding,onClose);assert.equal(disabled,adding);
    // Native disabled button suppresses click dispatch. Handler itself remains base-exact.
    if(!disabled)evaluate(button,'onClick',adding,onClose)();
    assert.equal(closed,adding?0:2,'Internal close button');
  }
  for(const [node,key] of [[modalNode,'dismissDisabled'],[button,'disabled']]) {
    const a=attr(node,key);
    for(const replacement of ['',`${key}={false}`,`${key}={!adding}`]) {
      const mutated=sf.text.slice(0,a.getStart(sf))+replacement+sf.text.slice(a.end);
      assert.throws(()=>assertBookingCreateBusy(parse(mutated)),`${key}: ${replacement||'removed'} must fail`);
    }
  }
});
await test('calendar entry effect: desktop week, mobile day and explicit date precedence',()=>{
  const sf=parse(read('src/app/admin/calendar/page.tsx'));
  const view=collect(sf,n=>ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.name.elements[0]?.name?.getText()==='view')[0];
  assert.equal(view.initializer.arguments[0].text,'week');
  const effect=collect(sf,n=>ts.isCallExpression(n)&&n.expression.getText()==='useEffect'&&n.arguments[0]?.getText().includes('URLSearchParams'))[0];assert(effect);
  const code=ts.transpileModule(`const run = ${effect.arguments[0].getText()}; run();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [mobile,search,expected] of [[false,'',null],[true,'','day'],[false,'?date=2026-10-17','day'],[true,'?date=2026-10-17','day']]) {
    const updates=[];vm.runInNewContext(code,{URLSearchParams,window:{location:{search},matchMedia:()=>({matches:mobile})},moscowDate:x=>new Date(x),setSelectedDay:x=>updates.push(['day',x]),setCurrentMonth:x=>updates.push(['month',x]),setView:x=>updates.push(['view',x])},{timeout:1000});
    assert.equal(updates.find(x=>x[0]==='view')?.[1]??null,expected);
    assert.equal(updates.filter(x=>x[0]!=='view').length,search?2:0);
  }
});
await test('modal presentation is optional exact union with unchanged default',()=>{
  const sf=parse(read(modal));
  const props=collect(sf,n=>ts.isPropertySignature(n)&&n.name.getText()==='presentation');assert.equal(props.length,2);
  for(const p of props) {assert(p.questionToken);assert(ts.isUnionTypeNode(p.type));assert.deepEqual(p.type.types.map(t=>t.literal.text),['dialog','booking','panel']);}
  const current=loadModal(read(modal)).exports,old=loadModal(before(modal)).exports;
  const propsValue={title:'QA',children:'Synthetic',onCancel:()=>{}};
  const a=old.default(propsValue),b=current.default(propsValue);
  assert.equal(b.type,'dialog');
  assert.equal(b.props.className,`${a.props.className} admin-presentation-dialog`);
  for(const key of ['role','aria-modal','aria-label','aria-busy','tabIndex'])assert.equal(b.props[key],a.props[key],key);
  assert.equal(nodes(b).filter(n=>n.type==='button'&&n.props.children==='Закрыть').length,1);
  for(const presentation of ['dialog','booking','panel']) {
    const wrapper=current.AdminModal({...propsValue,presentation,dismissDisabled:true});
    assert.equal(wrapper.props.presentation,presentation);assert.equal(wrapper.props.dismissDisabled,true);
    let closed=0;const tree=current.default({...propsValue,presentation,dismissDisabled:true,onCancel:()=>closed++});
    tree.props.onCancel({preventDefault(){}});assert.equal(closed,0);
    const close=nodes(tree).filter(n=>n.type==='button');assert.equal(close.length,presentation==='dialog'?1:0);
    if(close.length){assert.equal(close[0].props.disabled,true);close[0].props.onClick();assert.equal(closed,0);}
  }
});
await test('all presentations: confirm double click, pending dismissal, rejection and recovery',async()=>{
  for(const presentation of ['dialog','booking','panel']) {
    let calls=0,closed=0,resolve;const pending=new Promise(r=>{resolve=r;});const loaded=loadModal(read(modal));
    const tree=loaded.exports.default({title:'QA',children:'Synthetic',presentation,onCancel:()=>closed++,onConfirm:async()=>{calls++;await pending;}});
    assert.equal(tree.props.role,'alertdialog');const buttons=nodes(tree).filter(n=>n.type==='button');assert.equal(buttons.length,2);
    buttons[1].props.onClick();buttons[1].props.onClick();buttons[0].props.onClick();tree.props.onCancel({preventDefault(){}});
    assert.equal(calls,1);assert.equal(closed,0);resolve();await new Promise(setImmediate);assert.equal(closed,1);
    const rejected=loadModal(read(modal));closed=0;
    const errorTree=rejected.exports.default({title:'QA',presentation,onCancel:()=>closed++,onConfirm:async()=>{throw new Error('Synthetic failure');}});
    nodes(errorTree).filter(n=>n.type==='button')[1].props.onClick();await new Promise(setImmediate);
    assert.equal(closed,0);assert(rejected.states.includes('Synthetic failure'));errorTree.props.onCancel({preventDefault(){}});assert.equal(closed,1);
  }
});
await test('native modal mount/cleanup and keyboard focus logic stay base-exact',()=>{
  const effects=sf=>collect(sf,n=>ts.isCallExpression(n)&&n.expression.getText()==='useEffect').map(canon);
  assert.deepEqual(effects(parse(read(modal))),effects(parse(before(modal))));
  const keydown=sf=>openings(sf).filter(n=>n.tagName.getText()==='dialog').map(n=>canon(attr(n,'onKeyDown')));
  assert.deepEqual(keydown(parse(read(modal))),keydown(parse(before(modal))));
});
await test('AST guards detect payload/identity/consent/busy mutations and ignore CRLF',()=>{
  const a=parse('const x = () => fetch("/api/admin/bookings", {body: JSON.stringify({identity_confirmed: identity, consent_confirmed: consent})});');
  assert.equal(canon(a),canon(parse(a.text.replace(/;/g,';\r\n'))));
  for(const [from,to] of [['identity','false'],['consent','true'],['/api/admin/bookings','/api/public/bookings']])assert.notEqual(canon(a),canon(parse(a.text.replace(from,to))));
  assert.notEqual(canon(parse('<button disabled={busy} onClick={save}/>')),canon(parse('<button disabled={false} onClick={save}/>')));
});
console.log(`Stage 3.1: ${passed} VERIFIED, ${failed} BLOCKED groups. Base ${base}.`);
console.log('NOT TESTED browser geometry, real focus/scroll, production auth/RLS and provider integration. VM renders synthetic controls only.');
process.exitCode=failed?1:0;
})();
