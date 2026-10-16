// Independent, offline Phase 2 guards. Source AST + isolated VM fixtures; no app dependencies/network/DB.
// Run: node tests/admin-design-phase2.cjs [base-ref] (default is the agreed Phase 1 base).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const vm = require('node:vm');
const approvedFeedback = {
  'src/app/admin/media/page.tsx': ['Ошибка удаления', 'Ошибка удаления'],
  'src/app/admin/psychology/page.tsx': ['Не удалось удалить программу', 'Не удалось сохранить порядок. Обновите страницу.'],
};
const root = path.resolve(__dirname, '..');
const base = process.argv[2] || 'd43d168';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
git('rev-parse', '--verify', `${base}^{commit}`);
const list = text => text.split('\0').filter(Boolean);
const tracked = list(git('ls-tree', '-rz', '--name-only', base));
const baseline = file => git('show', `${base}:${file}`);
const current = file => fs.readFileSync(path.join(root, file), 'utf8');
const normalized = text => text.replace(/\r\n/g, '\n');
const changed = [...new Set([...list(git('diff', '--name-only', '-z', base)),
  ...list(git('ls-files', '--others', '--exclude-standard', '-z'))])];
const parse = (file, text) => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `${file}: TypeScript parse errors`);
  return source;
};
function canonical(node, source, eraseJsx = false) {
  const result = ts.transform(node, [context => {
    const visit = n => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'alert'
        && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])
        && approvedFeedback[source.fileName]?.includes(n.arguments[0].text)) {
        return ts.factory.updateCallExpression(n, ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('toast'), 'error'), n.typeArguments, n.arguments);
      }
      return eraseJsx && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n))
        ? ts.factory.createIdentifier('__PRESENTATION__') : ts.visitEachChild(n, visit, context);
    };
    return visit;
  }]);
  function shape(n) {
    if (ts.isParenthesizedExpression(n)) return shape(n.expression);
    const children = [];
    ts.forEachChild(n, child => { children.push(shape(child)); });
    return [ts.SyntaxKind[n.kind], ...(typeof n.text === 'string' ? [n.text] : []),
      ...(typeof n.operator === 'number' ? [ts.SyntaxKind[n.operator]] : []), ...children];
  }
  try { return JSON.stringify(shape(result.transformed[0])); }
  finally { result.dispose(); }
}
function walk(node, visit) { visit(node); ts.forEachChild(node, child => walk(child, visit)); }
const sorted = values => values.sort();
// Explicit confirmation migration contracts; no file-wide logic exemption.
const confirmationPlans = {
  media: ['deleteTarget', 'setDeleteTarget', '{ id: number; title: string } | null', 'handleDelete',
    'onClick', '() => handleDelete(item.id, item.title)', '() => setDeleteTarget({ id: item.id, title: item.title })'],
  products: ['deleteTarget', 'setDeleteTarget', '{ id: string; name: string } | null', 'deleteProduct',
    'onDelete', 'deleteProduct', 'id => setDeleteTarget({ id, name: products.find(item => item.id === id)?.name || "Без названия" })'],
  psychology: ['deleteTarget', 'setDeleteTarget', '{ id: number; title: string } | null', 'handleDelete',
    'onDelete', 'handleDelete', '(id, title) => setDeleteTarget({ id, title })'],
  'psychology-rooms': ['closeTarget', 'setCloseTarget', 'Room | null', 'close',
    'onClick', '() => void close(room.id)', '() => setCloseTarget(room)'],
  reviews: ['deleteTarget', 'setDeleteTarget', 'Review | null', 'deleteReview',
    'onClick', '() => deleteReview(review.id)', '() => setDeleteTarget(review)'],
  'payment-links': ['confirmNewPayment', 'setConfirmNewPayment', null, null, 'onClick',
    '() => { if (!window.confirm("Начать отдельный платёж? Предыдущая операция могла уже создать ссылку. Сначала проверьте историю.")) return; operation.current = null; setOperationPending(false); }',
    '() => setConfirmNewPayment(true)'],
};
function confirmationPlan(source) {
  const key = Object.keys(confirmationPlans).find(key => source.fileName === `src/app/admin/${key}/page.tsx`);
  if (!key) return null;
  const [state, setter, type, handler, event, oldTrigger, newTrigger] = confirmationPlans[key];
  return { key, state, setter, type, handler, event, oldTrigger, newTrigger };
}
const expression = text => parse('contract.tsx', `const contract = (${text});`).statements[0].declarationList.declarations[0].initializer;
const expressionShape = text => canonical(expression(text), parse('contract.tsx', ''));
function isDialog(n, source) { return (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n))
  && (ts.isJsxElement(n) ? n.openingElement : n).tagName.getText(source) === 'AdminConfirmDialog'; }
function checkConfirmationRouting(source, plan) {
  const dialogs = [];
  walk(source, n => { if (isDialog(n, source)) dialogs.push(n); });
  assert.equal(dialogs.length, 1, `${plan.key}: exactly one confirmation dialog required`);
  const dialog = dialogs[0], opening = ts.isJsxElement(dialog) ? dialog.openingElement : dialog;
  let parent = dialog.parent;
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
  assert(ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    && ts.isIdentifier(parent.left) && parent.left.text === plan.state, 'Dialog must be gated by the selected target');
  const callbacks = {};
  for (const attr of opening.attributes.properties) {
    assert(ts.isJsxAttribute(attr), 'No dialog spread allowed');
    const name = attr.name.getText(source);
    assert(['title', 'confirmLabel', 'pendingLabel', 'onCancel', 'onConfirm'].includes(name), `Unreviewed dialog prop ${name}`);
    if (name === 'onCancel' || name === 'onConfirm') {
      assert(attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression);
      callbacks[name] = attr.initializer.expression;
    } else walk(attr, n => assert(!ts.isCallExpression(n), 'Dialog presentation cannot call functions'));
  }
  const cancel = `() => ${plan.setter}(${plan.type ? 'null' : 'false'})`;
  const confirm = plan.handler ? `() => ${plan.handler}(${plan.state}.id)`
    : 'async () => { operation.current = null; setOperationPending(false); }';
  assert(callbacks.onCancel && callbacks.onConfirm, 'Both dialog callbacks required');
  assert.equal(canonical(callbacks.onCancel, source), expressionShape(cancel), 'Cancellation may only clear UI state');
  assert.equal(canonical(callbacks.onConfirm, source), expressionShape(confirm), 'Confirmation must await/return the original operation');
  if (ts.isJsxElement(dialog)) for (const child of dialog.children) walk(child, n => assert(!ts.isCallExpression(n), 'Dialog content cannot invoke mutations'));
  let triggers = 0;
  walk(source, n => {
    if (ts.isJsxAttribute(n) && n.name.getText(source) === plan.event && n.initializer && ts.isJsxExpression(n.initializer)
      && n.initializer.expression && canonical(n.initializer.expression, source) === expressionShape(plan.newTrigger)) triggers++;
  });
  assert.equal(triggers, 1, 'Exactly one UI-only opening route required');
  let states = 0, mutationReferences = 0;
  walk(source, n => {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name)
      && n.name.elements.some(e => ts.isBindingElement(e) && ts.isIdentifier(e.name) && e.name.text === plan.state)) states++;
    if (plan.handler && ts.isIdentifier(n) && n.text === plan.handler) {
      const declaration = (ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent)) && n.parent.name === n;
      if (!declaration) {
        mutationReferences++;
        let owner = n.parent;
        while (owner && !ts.isJsxAttribute(owner)) owner = owner.parent;
        assert(owner?.name.getText(source) === 'onConfirm', 'Mutation handler may only be referenced by confirmation');
      }
    }
  });
  assert.equal(states, 1, 'Exactly one confirmation state required');
  if (plan.handler) assert.equal(mutationReferences, 1, 'Exactly one confirmed mutation route required');
}
const visualNodes = {
  'src/app/admin/bookings/page.tsx': { STATUS_CONFIG: ['className'], SERVICE_TYPES: ['color'] },
  'src/app/admin/orders/page.tsx': { STATUS_CONFIG: ['badge', 'tone'] },
  'src/app/admin/payment-links/page.tsx': { STATUS: ['className', 'tone'] },
  'src/app/admin/settings/page.tsx': { themes: ['gradient'] },
};
const visualLiterals = {
  'src/app/admin/promotions/page.tsx': { inputClass: ['h-11 rounded-xl border bg-[var(--input-bg)] px-3'] },
  'src/components/admin/SchedulingTemplates.tsx': { input: ['mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900', 'mt-1'] },
  'src/app/admin/settings/page.tsx': { fieldClass: ['h-12 w-full rounded-xl border px-4 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-[var(--admin-accent)]/25'] },
};
function logic(source) {
  const plan = confirmationPlan(source);
  const transformed = ts.transform(source, [context => {
    function visit(n) {
      if (ts.isVariableStatement(n) && n.declarationList.declarations.length === 1) {
        const d = n.declarationList.declarations[0], name = d.name.getText(source);
        if (plan && ts.isArrayBindingPattern(d.name) && d.name.elements.some(e => ts.isBindingElement(e) && ts.isIdentifier(e.name) && e.name.text === plan.state)) {
          const expected = parse('contract.tsx', `const [${plan.state}, ${plan.setter}] = useState${plan.type ? `<${plan.type}>` : ''}(${plan.type ? 'null' : 'false'});`).statements[0];
          assert.equal(canonical(n, source), canonical(expected, parse('contract.tsx', '')), 'Only the approved local UI state may be added');
          return undefined;
        }
        const literals = visualLiterals[source.fileName]?.[name];
        if (literals) {
          assert(d.initializer && ts.isStringLiteral(d.initializer) && literals.includes(d.initializer.text), `Unreviewed visual literal ${source.fileName}:${name}`);
          walk(source, ref => {
            if (!ts.isIdentifier(ref) || ref.text !== name || ref === d.name) return;
            if ((ts.isJsxOpeningElement(ref.parent) || ts.isJsxClosingElement(ref.parent) || ts.isJsxSelfClosingElement(ref.parent)) && ref.parent.tagName === ref) return;
            let owner = ref.parent;
            while (owner && !ts.isJsxAttribute(owner)) owner = owner.parent;
            assert(owner && owner.name.getText(source) === 'className', `${name}: non-presentation reference requires review`);
          });
          return undefined;
        }
        if (source.fileName === 'src/app/admin/settings/page.tsx' && name === 'cardStyle') {
          assert(ts.isObjectLiteralExpression(d.initializer));
          const expected = { background: 'var(--admin-panel)', borderColor: 'var(--admin-border)', boxShadow: 'var(--admin-shadow)' };
          assert.deepEqual(Object.fromEntries(d.initializer.properties.map(p => {
            assert(ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer));
            return [p.name.getText(source), p.initializer.text];
          })), expected);
          return undefined;
        }
      }
      // Baseline-only native confirm removal, scoped to the original mutation handler.
      if (plan?.handler && (ts.isFunctionDeclaration(n) && n.name?.text === plan.handler
        || ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === plan.handler)) {
        const fn = ts.isFunctionDeclaration(n) ? n : n.initializer;
        if (fn && ts.isBlock(fn.body)) {
          const originalSource = parse(source.fileName, baseline(source.fileName));
          let originalFn;
          walk(originalSource, candidate => {
            if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === plan.handler) originalFn = candidate;
            if (ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === plan.handler) originalFn = candidate.initializer;
          });
          const originalStatements = originalFn.body.statements;
          const confirmIndex = plan.key === 'products' ? 1 : 0;
          const originalGuard = originalStatements[confirmIndex];
          assert(ts.isIfStatement(originalGuard), 'Expected baseline confirm guard');
          const statements = fn.body.statements.filter(s => canonical(s, source) !== canonical(originalGuard, originalSource)
            && !(plan.key === 'products' && canonical(s, source) === canonical(originalStatements[0], originalSource)));
          const parameters = fn.parameters.filter(p => !(plan.key === 'media' || plan.key === 'psychology') || p.name.getText(source) !== 'title');
          const body = ts.factory.updateBlock(fn.body, statements);
          if (ts.isFunctionDeclaration(n)) return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, parameters, n.type, body);
          return ts.factory.updateVariableDeclaration(n, n.name, n.exclamationToken, n.type,
            ts.factory.updateArrowFunction(fn, fn.modifiers, fn.typeParameters, parameters, fn.type, fn.equalsGreaterThanToken, body));
        }
      }
      if (ts.isVariableDeclaration(n)) {
        const fields = visualNodes[source.fileName]?.[n.name.getText(source)];
        if (fields) {
          const clean = value => {
            if (ts.isPropertySignature(value) && fields.includes(value.name.getText(source))) return undefined;
            if (ts.isPropertyAssignment(value) && fields.includes(value.name.getText(source))) {
              assert(ts.isStringLiteral(value.initializer), 'Visual field must remain a literal');
              if (value.name.getText(source) === 'tone') assert(['success', 'warning', 'destructive', 'info', 'neutral'].includes(value.initializer.text));
              return undefined;
            }
            return ts.visitEachChild(value, clean, context);
          };
          // Only the reviewed presentation map's annotation changes; all runtime keys/labels remain compared.
          return ts.factory.updateVariableDeclaration(n, n.name, n.exclamationToken, n.type ? clean(n.type) : undefined, clean(n.initializer));
        }
      }
      return ts.visitEachChild(n, visit, context);
    }
    return visit;
  }]);
  try { return transformed.transformed[0].statements.filter(n => !ts.isImportDeclaration(n)).map(n => canonical(n, source, true)); }
  finally { transformed.dispose(); }
}
function contracts(source) {
  const handlers = [], requests = [], submits = [], controls = [];
  const plan = confirmationPlan(source);
  let migrated = false;
  walk(source, n => { if (isDialog(n, source)) migrated = true; });
  if (plan && migrated) checkConfirmationRouting(source, plan);
  function visit(node, inForm = false) {
    if (plan && migrated && isDialog(node, source)) return; // Exact callbacks/content verified above.
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = opening.tagName.getText(source);
      const nativeTag = ({ AdminButton: 'button', AdminInput: 'input', AdminCheckbox: 'input', AdminRadio: 'input',
        AdminSwitch: 'input', AdminSelect: 'select', AdminTextarea: 'textarea', AdminCard: 'section' })[tag] || tag;
      const attrs = opening.attributes.properties;
      const attr = name => attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === name);
      const value = name => attr(name)?.initializer ? canonical(attr(name).initializer, source, true) : '';
      for (const a of attrs) if (ts.isJsxAttribute(a) && /^on[A-Z]/.test(a.name.getText(source))) {
        const redirected = plan && migrated && a.name.getText(source) === plan.event && a.initializer
          && ts.isJsxExpression(a.initializer) && a.initializer.expression
          && canonical(a.initializer.expression, source) === expressionShape(plan.newTrigger);
        const initializer = redirected ? ts.factory.createJsxExpression(undefined, expression(plan.oldTrigger)) : a.initializer;
        handlers.push(`${nativeTag}:${a.name.getText(source)}:${initializer ? canonical(initializer, source, true) : ''}`);
      }
      const controlTag = /^(input|select|textarea|button|form|option|AdminInput|AdminSelect|AdminTextarea|AdminButton|AdminCheckbox|AdminSwitch|AdminRadio)$/.test(tag);
      for (const name of controlTag ? ['value', 'defaultValue', 'checked', 'defaultChecked', 'disabled', 'required', 'readOnly',
        'name', 'min', 'max', 'step', 'minLength', 'maxLength', 'pattern', 'multiple', 'action', 'method', 'encType', 'formAction'] : []) {
        if (attr(name)) controls.push(`${name}:${value(name)}`);
      }
      // Existing primitive (protected above) disables while loading. No broad disabled exception.
      if (tag === 'AdminButton' && attr('loading') && !attr('disabled')) controls.push(`disabled:${value('loading')}`);
      if (['input', 'AdminInput'].includes(tag) && attr('type')) controls.push(`input-type:${value('type')}`);
      if (['AdminCheckbox', 'AdminSwitch', 'AdminRadio'].includes(tag)) controls.push(`input-type:${JSON.stringify(['StringLiteral', tag === 'AdminRadio' ? 'radio' : 'checkbox'])}`);
      // Native omitted type submits; AdminButton defaults to button. Capture handler/form identity.
      if ((inForm || attr('form')) && ['button', 'AdminButton'].includes(tag)) {
        const type = attr('type');
        const literal = type?.initializer && ts.isStringLiteral(type.initializer) ? type.initializer.text : null;
        const effective = type ? literal || value('type') : tag === 'button' ? 'submit' : 'button';
        if (effective !== 'button' && effective !== 'reset') submits.push(`${effective}:${value('onClick')}:${value('form')}`);
      }
      inForm ||= tag === 'form';
    }
    if (ts.isCallExpression(node) && /^(fetch|.*\.(?:post|put|patch|delete|request)|JSON\.stringify)$/.test(node.expression.getText(source))) {
      requests.push(canonical(node, source, true));
    }
    ts.forEachChild(node, child => visit(child, inForm));
  }
  visit(source);
  return { handlers: sorted(handlers), requests: sorted(requests), submits: sorted(submits), controls: sorted(controls) };
}
let failures = 0, passed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`VERIFIED ${name}`); }
  catch (error) {
    failures++;
    const detail = error.actual && error.expected && Array.isArray(error.actual) && Array.isArray(error.expected)
      ? `added=${JSON.stringify(error.actual.filter(n => !error.expected.includes(n)))} removed=${JSON.stringify(error.expected.filter(n => !error.actual.includes(n)))}`
      : error.message;
    console.error(`BLOCKED ${name}\n${detail.slice(0, 1400)}`);
  }
}
const protectedFile = file => file.startsWith('src/') && !file.startsWith('src/app/admin/') && !file.startsWith('src/components/admin/')
  || /(^|\/)(migrations|public)\//.test(file) || /^(package(?:-lock)?\.json|next\.config\.)/.test(file);
test('backend/API/migrations/public components and dependency configuration unchanged', () => {
  assert.deepEqual(changed.filter(protectedFile), []);
});
const phase1 = ['src/app/admin/design-system.css', 'src/app/admin/admin.css',
  'src/app/admin/calendar/page.tsx', 'src/app/admin/dashboard/page.tsx',
  'src/components/admin/AdminToday.tsx', 'src/components/admin/ScheduleTimeline.tsx',
  'src/components/admin/bookings/BookingStatusBadge.tsx'];
for (const file of phase1) test(`Phase 1 unchanged: ${file}`, () => assert.equal(normalized(current(file)), normalized(baseline(file))));
test('existing confirmation dialog implementation unchanged', () => {
  const file = 'src/components/admin/AdminConfirmDialog.tsx';
  assert.equal(normalized(current(file)), normalized(baseline(file)));
});
for (const key of Object.keys(confirmationPlans)) test(`confirmation UI state/routing/cancel isolation: ${key}`, () => {
  const file = `src/app/admin/${key}/page.tsx`, source = parse(file, current(file));
  checkConfirmationRouting(source, confirmationPlan(source));
  walk(source, n => {
    if (ts.isCallExpression(n)) assert(!['confirm', 'window.confirm'].includes(n.expression.getText(source)), 'Native confirm remains');
  });
});
const uiFile = 'src/components/admin/ui/index.tsx';
test('existing DS2 primitive declarations unchanged; additive declarations allowed', () => {
  const before = parse(uiFile, baseline(uiFile)), after = parse(uiFile, current(uiFile));
  const oldStatements = before.statements.map(n => canonical(n, before));
  const newStatements = after.statements.map(n => canonical(n, after));
  for (const statement of oldStatements) assert(newStatements.includes(statement), `Existing primitive/import changed:\n${statement}`);
});
test('Phase 2 CSS consumes tokens without overriding palette or public scope', () => {
  const file = 'src/app/admin/phase2.css';
  if (!fs.existsSync(path.join(root, file))) return;
  const postcss = require('postcss'), css = postcss.parse(current(file));
  css.walkDecls(/^--/, decl => assert.fail(`Token override ${decl.prop}`));
  css.walkRules(rule => {
    for (const selector of postcss.list.comma(rule.selector)) assert(/^\.(admin-shell|admin-confirm-dialog)(?:\s|:|\[|$)/.test(selector.trim()), `Public scope ${selector}`);
  });
});
test('editor savebar uses scoped mobile safe-area offset and keeps explicit submit', () => {
  const css = require('postcss').parse(current('src/app/admin/phase2.css'));
  let matched = 0;
  css.walkRules('.admin-shell .bs-savebar', rule => {
    assert.equal(rule.parent.name, 'media');
    assert.equal(rule.parent.params, '(max-width: 1023px)');
    assert.equal(rule.nodes.find(n => n.prop === 'bottom')?.value, 'calc(88px + env(safe-area-inset-bottom))');
    matched++;
  });
  assert.equal(matched, 1);
  const file = 'src/app/admin/pages/[slug]/page.tsx', source = parse(file, current(file));
  const bars = [];
  walk(source, n => {
    if (ts.isJsxElement(n) && n.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a)
      && a.name.getText(source) === 'className' && a.initializer && ts.isStringLiteral(a.initializer)
      && a.initializer.text.split(/\s+/).includes('bs-savebar'))) bars.push(n);
  });
  assert.equal(bars.length, 1);
  assert(contracts(source).submits.length > 0, 'Save remains an explicit form submit');
});
for (const [file, messages] of Object.entries(approvedFeedback)) test(`exact approved feedback replacement: ${file}`, () => {
  const collect = (source, name) => {
    const found = [];
    walk(source, n => {
      if (ts.isCallExpression(n) && n.expression.getText(source) === name) {
        assert(n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0]), 'Feedback must retain a single literal');
        found.push(n.arguments[0].text);
      }
    });
    return found.sort();
  };
  assert.deepEqual(collect(parse(file, baseline(file)), 'alert'), [...messages].sort());
  const source = parse(file, current(file));
  assert.deepEqual(collect(source, 'alert'), []);
  assert.deepEqual(collect(source, 'toast.error'), [...messages].sort());
});
for (const file of changed.filter(f => /^(src\/app\/admin\/|src\/components\/admin\/).*\.tsx?$/.test(f) && f !== uiFile)) {
  if (!tracked.includes(file)) { console.log(`NOT TESTED ${file}: new UI file has no baseline logic`); continue; }
  test(`non-visual imports unchanged: ${file}`, () => {
    const plan = confirmationPlan(parse(file, current(file)));
    const select = source => source.statements.filter(n => ts.isImportDeclaration(n)
      && !['@/components/admin/ui', 'lucide-react', './phase2.css'].includes(n.moduleSpecifier.text))
      .filter(n => {
        if (!plan || n.moduleSpecifier.text !== '@/components/admin/AdminConfirmDialog') return true;
        assert(n.importClause?.name?.text === 'AdminConfirmDialog' && !n.importClause.namedBindings && !n.importClause.isTypeOnly, 'Exact default dialog import required');
        return false;
      }).filter(n => {
        if (!approvedFeedback[file] || n.moduleSpecifier.text !== 'sonner') return true;
        assert.equal(canonical(n, source), canonical(parse('contract.tsx', 'import { toast } from "sonner";').statements[0], source), 'Only exact toast import allowed');
        return false;
      }).map(n => canonical(n, source));
    assert.deepEqual(select(parse(file, current(file))), select(parse(file, baseline(file))));
  });
  test(`AST non-JSX computations/hooks/functions: ${file}`, () => {
    const before = logic(parse(file, baseline(file))), after = logic(parse(file, current(file)));
    assert(before.length === after.length && before.every((n, i) => n === after[i]), `${file}: changed non-JSX statements; inspect git diff ${base} -- ${file}`);
  });
  for (const key of ['handlers', 'requests', 'submits', 'controls']) test(`AST ${key}: ${file}`, () => {
    assert.deepEqual(contracts(parse(file, current(file)))[key], contracts(parse(file, baseline(file)))[key]);
  });
}
test('guard self-check: logic/payload/handler/implicit submit mutations are detected', () => {
  const sample = text => parse('self.tsx', text);
  const a = sample('function A(){const [x,s]=useState(1);return <form><button onClick={()=>s(2)}>OK</button></form>}');
  assert.notDeepEqual(logic(a), logic(sample('function A(){const [x,s]=useState(9);return <form/>}')));
  assert.notDeepEqual(contracts(a).handlers, contracts(sample('function A(){return <button onClick={()=>s(3)}/>}')).handlers);
  assert.notDeepEqual(contracts(a).submits, contracts(sample('function A(){return <form><AdminButton onClick={()=>s(2)}>OK</AdminButton></form>}')).submits);
  assert.notDeepEqual(contracts(sample('fetch("/api/a",{body:JSON.stringify({id:1})})')).requests,
    contracts(sample('fetch("/api/a",{body:JSON.stringify({id:2})})')).requests);
  assert.notDeepEqual(logic(sample('const enabled = !busy')), logic(sample('const enabled = +busy')));
  assert.deepEqual(contracts(sample('<button type="submit" onClick={()=>pay()} disabled={busy}/>')),
    contracts(sample('<AdminButton type="submit" onClick={()=>pay()} loading={busy}/>')));
  assert.notDeepEqual(contracts(sample('<button onClick={()=>pay()}/>')).handlers,
    contracts(sample('<div onClick={()=>pay()}/>')).handlers);
  const visual = text => parse('src/app/admin/orders/page.tsx', text);
  assert.deepEqual(logic(visual('const STATUS_CONFIG = {paid:{label:"Paid",badge:"old"}}')),
    logic(visual('const STATUS_CONFIG = {paid:{label:"Paid",tone:"success"}}')));
  assert.notDeepEqual(logic(visual('const STATUS_CONFIG = {paid:{label:"Paid",badge:"old"}}')),
    logic(visual('const STATUS_CONFIG = {paid:{label:"Unpaid",tone:"success"}}')));
});
test('confirmation guard rejects mutation on cancel/open and wrong/unreturned confirmation target', () => {
  const file = 'src/app/admin/reviews/page.tsx';
  const fixture = (cancel, confirm, trigger = '() => setDeleteTarget(review)') => parse(file,
    `function Example(){ const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
      return <><AdminButton onClick={${trigger}}/>{deleteTarget && <AdminConfirmDialog title="Delete?"
        onCancel={${cancel}} onConfirm={${confirm}}><p>{deleteTarget.author_name}</p></AdminConfirmDialog>}</>; }`);
  const check = source => checkConfirmationRouting(source, confirmationPlan(source));
  check(fixture('() => setDeleteTarget(null)', '() => deleteReview(deleteTarget.id)'));
  assert.throws(() => check(fixture('() => deleteReview(deleteTarget.id)', '() => deleteReview(deleteTarget.id)')));
  assert.throws(() => check(fixture('() => setDeleteTarget(null)', '() => deleteReview(review.id)')));
  assert.throws(() => check(fixture('() => setDeleteTarget(null)', '() => { deleteReview(deleteTarget.id); }')));
  assert.throws(() => check(fixture('() => setDeleteTarget(null)', '() => deleteReview(deleteTarget.id)', '() => deleteReview(review.id)')));
});
// Static local-import reachability only: neither migration completeness nor browser acceptance.
const sources = new Map();
function collect(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collect(file);
    else if (/\.tsx?$/.test(file)) sources.set(file, parse(file, current(file)));
  }
}
collect('src/app/admin'); collect('src/components/admin');
function imports(file) {
  return sources.get(file).statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier.text);
}
function resolve(from, specifier) {
  const target = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : specifier.startsWith('.')
    ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)) : '';
  return [target, `${target}.tsx`, `${target}.ts`, `${target}/index.tsx`, `${target}/index.ts`].find(f => sources.has(f));
}
console.log('NOT TESTED route inventory: static imports only; layout inheritance excluded; no all-migrated claim');
for (const route of [...sources.keys()].filter(f => /\/page\.tsx?$/.test(f)).sort()) {
  const seen = new Set(), consumers = [];
  function follow(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (imports(file).some(s => s === '@/components/admin/ui' || resolve(file, s) === uiFile)) consumers.push(file);
    for (const specifier of imports(file)) { const next = resolve(file, specifier); if (next && next !== uiFile) follow(next); }
  }
  follow(route);
  console.log(`${route}: ${consumers.length ? 'DS2 import reachable via ' + consumers.sort().join(', ') : 'no DS2 import found'}`);
}
async function confirmationFixtures() {
  const modalFile = 'src/components/admin/AdminConfirmDialog.tsx';
  const transpile = code => ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modalCode = transpile(current(modalFile));
  for (const key of Object.keys(confirmationPlans).filter(key => key !== 'payment-links')) {
    try {
      const file = `src/app/admin/${key}/page.tsx`, source = parse(file, current(file)), plan = confirmationPlan(source);
      let handler;
      walk(source, n => {
        if (ts.isFunctionDeclaration(n) && n.name?.text === plan.handler) handler = n;
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === plan.handler) handler = n.initializer;
      });
      assert(handler, 'Actual mutation handler required');
      const handlerText = ts.createPrinter().printNode(ts.EmitHint.Unspecified, handler, source);
      for (const transportFailure of [false, true]) {
        let requests = 0, closed = 0;
        const errors = [], context = { exports: {}, Error,
          fetch: async (_url, options) => {
            requests++;
            assert.equal(options.method, 'DELETE');
            if (transportFailure) throw new Error('Synthetic offline transport failure');
            return { ok: false, json: async () => ({ error: 'Synthetic HTTP rejection' }) };
          },
          alert: message => errors.push(message), toast: { error: message => errors.push(message) },
          setError: message => { if (message) errors.push(message); }, setBusy() {},
        };
        vm.runInNewContext(transpile(`exports.subject = (${handlerText});`), context, { timeout: 1000 });
        const exports = {}, jsx = (type, props) => ({ type, props });
        const mocks = {
          react: { useEffect() {}, useId: () => 'qa-id', useRef: current => ({ current }),
            useState: initial => [initial, value => { if (typeof value === 'string' && value) errors.push(value); }] },
          'react-dom': { createPortal: value => value }, 'react/jsx-runtime': { jsx, jsxs: jsx },
        };
        vm.runInNewContext(modalCode, { exports, Error, document: { body: {} },
          require: name => { assert(Object.hasOwn(mocks, name), `Unmocked dependency ${name}`); return mocks[name]; } }, { timeout: 1000 });
        const make = () => exports.default({ title: 'Synthetic confirmation', children: 'Fixture only',
          onCancel: () => { closed++; }, onConfirm: () => context.exports.subject(key === 'products' || key === 'psychology-rooms' ? 'fixture-id' : 1) });
        const cancelled = make();
        cancelled.props.children.props.children[2].props.children[0].props.onClick();
        assert.equal(requests, 0, 'Cancel must never mutate');
        const escaped = make();
        escaped.props.onCancel({ preventDefault() {} });
        assert.equal(requests, 0, 'Escape must never mutate');
        closed = 0;
        const confirmed = make(), buttons = confirmed.props.children.props.children[2].props.children;
        buttons[1].props.onClick(); buttons[1].props.onClick(); buttons[0].props.onClick();
        assert.equal(requests, 1, 'Repeated confirmation cannot issue a second DELETE');
        assert.equal(closed, 0, 'Pending operation cannot be dismissed');
        await new Promise(setImmediate);
        assert.equal(errors.length, 1, 'Failure must reach existing page feedback');
        if (closed) console.log(`VERIFIED residual feedback risk: ${key}/${transportFailure ? 'transport' : 'HTTP'} failure dismisses dialog after page feedback (${closed} close)`);
      }
      test(`isolated actual handler + dialog cancel/Escape/duplicate/error feedback: ${key}`, () => {});
    } catch (error) { test(`isolated actual handler + dialog: ${key}`, () => { throw error; }); }
  }
}
confirmationFixtures().then(() => {
  console.log(`Phase 2: ${passed} VERIFIED, ${failures} BLOCKED guard groups. Browser/real app runtime/accessibility: NOT TESTED.`);
  process.exitCode = failures ? 1 : 0;
}).catch(error => { console.error(error); process.exitCode = 1; });
