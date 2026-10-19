// Offline program UI regression: isolated initial renders, NOT browser hydration.
// Run: node tests/quiet-program.cjs
// All fetch/timers/UUID/navigation are synthetic. Never imports application APIs,
// DB or provider clients; never sends a payment/enrollment or writes a file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const base = '8d6aa48645651c7df827c9dab483cb69318696ed';
const payment = 'src/components/ProgramPaymentSection.tsx';
const enrollment = 'src/components/ProgramEnrollmentForm.tsx';
const transport = 'src/components/PaymentButton.tsx';
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const baseline = file => execFileSync('git', ['show', `${base}:${file}`], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props: props || {} });
const treeNodes = tree => Array.isArray(tree) ? tree.flatMap(treeNodes)
  : tree && typeof tree === 'object' ? [tree, ...treeNodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('')
  : tree && typeof tree === 'object' ? text(tree.props?.children)
    : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
let groups = 0;
async function test(name, run) { await run(); groups++; console.log(`PASS ${name}`); }

function load(file, source, imports, globals = {}, defaultLocale = 'en-US') {
  const result = ts.transpileModule(source, {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(result.diagnostics.length, 0, `Parse/transpile failure: ${file}`);
  const mod = { exports: {} };
  const context = vm.createContext({ module: mod, exports: mod.exports, require: name => {
    assert(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
    return imports[name];
  }, ...globals });
  // Change ONLY this VM realm's default locale. Explicit locale arguments remain
  // authoritative; changing process.env.LANG or the host prototype is unnecessary.
  vm.runInContext(`{
    const original = Number.prototype.toLocaleString;
    Number.prototype.toLocaleString = function(locale, options) {
      return original.call(this, locale === undefined ? ${JSON.stringify(defaultLocale)} : locale, options);
    };
  }`, context);
  vm.runInContext(result.outputText, context, { filename: file, timeout: 2000 });
  return mod.exports;
}
const phone = load('src/lib/phone.ts', read('src/lib/phone.ts'), {});
function mount(file, { source = read(file), locale = 'en-US', props = {}, profile = null } = {}) {
  const hooks = [], effects = [], requests = [], timers = [], alerts = [];
  let cursor = 0, dirty = false, tree;
  const react = {
    useState(initial) {
      const i = cursor++;
      hooks[i] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[i].value, next => {
        const value = typeof next === 'function' ? next(hooks[i].value) : next;
        if (!Object.is(value, hooks[i].value)) { hooks[i].value = value; dirty = true; }
      }];
    },
    useId() { const i = cursor++; hooks[i] ||= { value: ':qa-program:' }; return hooks[i].value; },
    useRef(initial) { const i = cursor++; return hooks[i] ||= { current: initial }; },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, value: factory() };
      return hooks[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) {
        hooks[i] = { deps };
        effects.push(effect);
      }
    },
  };
  class Clock extends Date { static now() { return 1_800_000_000_000; } }
  const api = load(file, source, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'lucide-react': Object.fromEntries(['Mail', 'Phone', 'ShieldCheck', 'BadgeCheck', 'Sparkles', 'CreditCard', 'CheckCircle2', 'AlertCircle'].map(name => [name, name])),
    'framer-motion': { motion: { div: 'MotionDiv' }, AnimatePresence: 'AnimatePresence' },
    'next/link': { default: 'Link' },
    '@/components/PaymentButton': { default: 'PaymentButton' },
    '@/components/legal/PersonalDataConsent': { default: 'Consent' },
    '@/components/ui/TextField': { default: 'TextField' },
    '@/components/ui/ChoiceField': { TextareaField: 'TextareaField' },
    '@/components/ui/button': { Button: 'Button' },
    '@/lib/phone': phone,
    '@/lib/hooks/use-account-prefill': { useAccountPrefill: () => profile },
  }, {
    Date: Clock,
    crypto: { randomUUID: () => 'synthetic-attempt-uuid' },
    fetch: async (url, options) => {
      requests.push({ url, options: plain(options) });
      return { ok: true, json: async () => ({ success: false, error: 'Synthetic response; no payment exists' }) };
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    alert: message => alerts.push(message),
    window: { location: { set href(_) { assert.fail('No navigation permitted'); } } },
  }, locale);
  function render() {
    let rounds = 0;
    do { assert(++rounds < 12); dirty = false; cursor = 0; tree = api.default(props); } while (dirty);
    return tree;
  }
  render(); // SSR / first client render: effects deliberately have not run.
  const all = predicate => treeNodes(render()).filter(predicate);
  const child = type => { const matches = all(n => n.type === type); assert.equal(matches.length, 1, type); return matches[0]; };
  return {
    render, all, child, requests, timers, alerts,
    runEffects() { while (effects.length) effects.shift()(); render(); },
    consent(value) { child('Consent').props.onChange(value); render(); },
    field(type, value) {
      const matches = all(n => ['input', 'TextField', 'textarea', 'TextareaField'].includes(n.type)
        && (type === 'message' ? ['textarea', 'TextareaField'].includes(n.type) : n.props.type === type));
      assert.equal(matches.length, 1, type);
      matches[0].props.onChange({ target: { value } }); render();
    },
  };
}
function initialPrice(source, locale, price = 25000) {
  const c = mount(payment, { source, locale, props: { title: 'Synthetic program', price } });
  const spans = c.all(n => n.type === 'span' && typeof n.props.className === 'string' && n.props.className.includes('text-3xl'));
  assert.equal(spans.length, 1, 'Exactly one visible price');
  return { display: text(spans[0]), action: c.child('PaymentButton').props.label };
}
function parse(file, source) { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function canonical(node) {
  if (ts.isIdentifier(node)) return ['id', node.text];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return ['string', node.text];
  if (ts.isNumericLiteral(node)) return ['number', node.text];
  return [ts.SyntaxKind[node.kind], ...node.getChildren().map(canonical)];
}
function findNodes(source, predicate) {
  const result = [];
  function walk(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, walk); }
  walk(source);
  return result;
}
function paymentContract(source) {
  const ast = parse(payment, source);
  const elements = findNodes(ast, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'PaymentButton');
  assert.equal(elements.length, 1);
  return Object.fromEntries(elements[0].attributes.properties.filter(node => {
    assert(ts.isJsxAttribute(node), 'Payment prop spreads require explicit review');
    return !['label', 'className'].includes(node.name.text);
  }).map(node => [node.name.text, canonical(node.initializer)]));
}
function namedCallback(file, source, name) {
  const ast = parse(file, source);
  const nodes = findNodes(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name);
  assert.equal(nodes.length, 1, name);
  return canonical(nodes[0].initializer);
}
function callbacks(source, file) {
  const ast = parse(file, source);
  return findNodes(ast, node => ts.isJsxAttribute(node) && node.name.text === 'onChange').map(node => canonical(node.initializer));
}
function businessProps(c) {
  const values = { ...c.child('PaymentButton').props };
  delete values.label; delete values.className;
  return plain(values);
}
const fieldReact = {
  useId: () => ':synthetic-field:', useState: value => [value, () => {}],
  forwardRef: render => props => render(props, null),
};
const fieldImports = {
  react: fieldReact, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  'lucide-react': { Eye: 'Eye', EyeOff: 'EyeOff' },
  '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  'next/link': { default: 'Link' },
};
const fields = {
  TextField: load('src/components/ui/TextField.tsx', read('src/components/ui/TextField.tsx'), fieldImports).default,
  TextareaField: load('src/components/ui/ChoiceField.tsx', read('src/components/ui/ChoiceField.tsx'), fieldImports).TextareaField,
  Consent: load('src/components/legal/PersonalDataConsent.tsx', read('src/components/legal/PersonalDataConsent.tsx'), fieldImports).default,
};
function accessibleFields(c) {
  const ids = new Set();
  for (const node of c.all(n => Object.hasOwn(fields, n.type))) {
    const expanded = fields[node.type](node.props);
    const nodes = treeNodes(expanded);
    const labels = nodes.filter(n => n.type === 'label');
    const controls = nodes.filter(n => ['input', 'textarea'].includes(n.type));
    assert.equal(labels.length, 1); assert.equal(controls.length, 1);
    const label = labels[0], control = controls[0];
    assert(control.props.id && label.props.htmlFor === control.props.id, 'Associated label/id required');
    assert(!ids.has(control.props.id), 'Unique field ids'); ids.add(control.props.id);
    assert(text(label).trim(), 'Visible label required');
    if (node.type !== 'Consent') assert(node.props.label?.trim(), 'Field name, not placeholder, is required');
    assert.equal(control.props.disabled, node.props.disabled);
    assert.equal(control.props.required, node.type === 'Consent' ? true : node.props.required);
    assert.equal(typeof control.props.onChange, 'function');
    if (control.props['aria-describedby']) assert(nodes.some(n => n.props.id === control.props['aria-describedby']), 'Help reference resolves');
  }
  assert(ids.size >= 3, 'Fields and consent must all be checked');
}

async function main() {
  await test('baseline bug reproduces in BOTH SSR/client texts with different default locales', () => {
    const server = initialPrice(baseline(payment), 'en-US');
    const client = initialPrice(baseline(payment), 'ru-RU');
    assert.equal(server.display, '25,000 ₽');
    assert.equal(client.display, '25\u00a0000 ₽');
    assert.notEqual(server.display, client.display);
    assert.notEqual(server.action, client.action);
  });
  await test('current first-render price and payment label are identical across default locales', () => {
    for (const price of [1000, 25000, 3500.5]) {
      const expected = initialPrice(read(payment), 'ru-RU', price);
      for (const locale of ['en-US', 'ru-RU', 'de-DE', 'fr-FR']) assert.deepEqual(initialPrice(read(payment), locale, price), expected);
      assert.equal(expected.display, `${price.toLocaleString('ru-RU')} ₽`);
      assert.equal(expected.action, `Оплатить ${price.toLocaleString('ru-RU')} ₽ →`);
    }
  });
  await test('independent negative controls reject missing locale in either text', () => {
    const source = read(payment), needle = 'price.toLocaleString("ru-RU")';
    assert.equal(source.split(needle).length - 1, 2);
    for (const index of [0, 1]) {
      let seen = 0;
      const broken = source.replaceAll(needle, match => seen++ === index ? 'price.toLocaleString()' : match);
      assert.notDeepEqual(initialPrice(broken, 'en-US'), initialPrice(broken, 'ru-RU'));
    }
  });
  await test('all PaymentButton business prop ASTs match 8d6; only label/class are presentation', () => {
    assert.deepEqual(paymentContract(read(payment)), paymentContract(baseline(payment)));
    assert.deepEqual(namedCallback(payment, read(payment), 'orderId'), namedCallback(payment, baseline(payment), 'orderId'));
    for (const [before, after] of [['amount={price}', 'amount={price + 1}'], ['quantity: 1', 'quantity: 2'],
      ['orderId={orderId}', 'orderId={title}'], ['consent={consent}', 'consent={true}'],
      ['disabled={!consent || (!email.trim() && !phone.trim())}', 'disabled={false}']]) {
      assert(read(payment).includes(before));
      assert.notDeepEqual(paymentContract(read(payment).replace(before, after)), paymentContract(baseline(payment)));
    }
  });
  await test('named submit/payment callbacks, field handlers and actual payment transport are unchanged', () => {
    assert.deepEqual(namedCallback(enrollment, read(enrollment), 'handleSubmit'), namedCallback(enrollment, baseline(enrollment), 'handleSubmit'));
    assert.deepEqual(namedCallback(transport, read(transport), 'handlePay'), namedCallback(transport, baseline(transport), 'handlePay'));
    for (const file of [payment, enrollment]) assert.deepEqual(callbacks(read(file), file), callbacks(baseline(file), file));
    assert.equal(read(transport), baseline(transport), 'Do not change the current payment flow for a display fix');
  });
  await test('email/phone/consent disabled truth table and orderId/items remain baseline-equivalent', () => {
    for (const email of ['', '  ', 'qa@example.invalid']) for (const phoneValue of ['', '89151234567']) for (const consent of [false, true]) {
      const pair = [baseline(payment), read(payment)].map(source => {
        const c = mount(payment, { source, props: { title: 'Synthetic program', price: 25000 } });
        c.field('email', email); c.field('tel', phoneValue); c.consent(consent); return c;
      });
      assert.deepEqual(businessProps(pair[1]), businessProps(pair[0]));
      const props = businessProps(pair[1]);
      assert.equal(props.disabled, !consent || (!email.trim() && !props.phone.trim()));
      assert.equal(props.amount, 25000); assert.equal(props.orderId, 'program-qa-program-1800000000000');
      assert.deepEqual(props.items, [{ name: 'Synthetic program', price: 25000, quantity: 1, serviceCode: 'recovery-program' }]);
      assert.equal(pair[1].requests.length, 0);
    }
  });
  await test('prefill and later contact edits preserve payment identity and caller data', () => {
    const profile = { email: 'profile@example.invalid', phone: '89151234567' };
    const pair = [baseline(payment), read(payment)].map(source => {
      const c = mount(payment, { source, profile, props: { title: 'Synthetic program', price: 25000 } });
      c.runEffects(); c.consent(true); return c;
    });
    assert.deepEqual(businessProps(pair[1]), businessProps(pair[0]));
    const identity = businessProps(pair[1]).orderId;
    pair.forEach(c => c.field('email', 'edited@example.invalid'));
    assert.deepEqual(businessProps(pair[1]), businessProps(pair[0]));
    assert.equal(businessProps(pair[1]).orderId, identity);
  });
  await test('real PaymentButton produces the identical synthetic request payload, never a network call', async () => {
    const snapshots = [];
    for (const source of [baseline(payment), read(payment)]) {
      const c = mount(payment, { source, props: { title: 'Synthetic program', price: 25000 } });
      c.field('email', 'qa@example.invalid'); c.field('tel', '89151234567'); c.consent(true);
      const button = mount(transport, { props: c.child('PaymentButton').props });
      assert.equal(button.child('button').props.disabled, false);
      await button.child('button').props.onClick();
      assert.equal(button.requests.length, 1);
      snapshots.push(button.requests[0]);
    }
    assert.deepEqual(snapshots[1], snapshots[0]);
    assert.equal(snapshots[1].url, '/api/payment/init');
    const body = JSON.parse(snapshots[1].options.body);
    assert.equal(body.amount, 25000); assert.equal(body.consent, true);
    assert.equal(body.orderId, 'program-qa-program-1800000000000-synthetic-attempt-uuid');
    assert.equal(body.customerEmail, 'qa@example.invalid'); assert.equal(body.items[0].serviceCode, 'recovery-program');
  });
  await test('enrollment named submit retains endpoint, payload, success reset and 5s timer', async () => {
    const captures = [];
    for (const source of [baseline(enrollment), read(enrollment)]) {
      const c = mount(enrollment, { source });
      c.field('text', 'Synthetic client'); c.field('tel', '89151234567'); c.field('message', 'Synthetic request'); c.consent(true);
      const submit = c.child('form').props.onSubmit({ preventDefault() {} });
      assert.equal(c.requests.length, 1);
      await submit;
      captures.push(c.requests[0]);
      assert.equal(c.timers.length, 1); assert.equal(c.timers[0].delay, 5000);
      const controls = c.all(n => ['input', 'TextField', 'textarea', 'TextareaField'].includes(n.type));
      assert.equal(controls.length, 3);
      controls.forEach(node => { assert.equal(node.props.value, ''); assert.equal(node.props.disabled, true); });
    }
    assert.deepEqual(captures[1], captures[0]);
    assert.equal(captures[1].url, '/api/program');
    assert.deepEqual(JSON.parse(captures[1].options.body), {
      client_name: 'Synthetic client', client_phone: '+7 (915) 123-45-67', notes: 'Synthetic request', consent: true,
    });
  });
  await test('payment/enrollment use real associated visible field labels, unique IDs and described hints', () => {
    const p = mount(payment, { props: { title: 'Synthetic program', price: 25000 } });
    const e = mount(enrollment);
    accessibleFields(p); accessibleFields(e);
    const email = p.all(n => n.type === 'TextField' && n.props.type === 'email')[0];
    assert.equal(email.props.autoComplete, 'email'); assert(email.props.hint);
    const name = e.all(n => n.type === 'TextField' && n.props.type === 'text')[0];
    const tel = e.all(n => n.type === 'TextField' && n.props.type === 'tel')[0];
    assert(name.props.required && tel.props.required);
    assert.equal(name.props.autoComplete, 'name'); assert.equal(tel.props.autoComplete, 'tel');
    assert.equal(e.child('Button').props.type, 'submit');
    assert.equal(e.child('Button').props.disabled, true);
    e.consent(true); assert.equal(e.child('Button').props.disabled, false);
  });
  await test('label negative control rejects placeholder-only payment field names', () => {
    const source = read(payment);
    assert(source.includes('label="Email для чека"'));
    const c = mount(payment, { source: source.replace('label="Email для чека"', 'label=""'),
      props: { title: 'Synthetic program', price: 25000 } });
    assert.throws(() => accessibleFields(c), /Field name, not placeholder/);
  });
  await test('nonpositive program price still suppresses the payment section without requests', () => {
    for (const price of [0, -1]) {
      const c = mount(payment, { props: { title: 'Synthetic program', price } });
      assert.equal(c.render(), null); assert.equal(c.requests.length, 0);
    }
  });
  console.log(`Quiet program: ${groups} groups PASS; baseline=${base}; real_network_calls=0; files_written=0.`);
  console.log('NOT TESTED actual browser hydration/React #418, layout and provider behavior; main owns exact-image CUA.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
