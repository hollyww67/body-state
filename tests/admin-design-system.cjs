// Offline component contracts and CSS guards; browser/device acceptance is separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const jsx = (type, props) => ({ type, props });
function load(file, extra = {}) {
  const exports = {};
  const mocks = {
    react: { forwardRef: render => (props, ref) => render(props, ref) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': { LoaderCircle: function LoaderCircle() {} },
    '@/lib/utils': { cn: (...values) => require('tailwind-merge').twMerge(require('clsx').clsx(values)) },
    ...extra,
  };
  const code = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert(Object.hasOwn(mocks, name), `Unexpected component dependency: ${name}`);
    return mocks[name];
  } }, { filename: file });
  return exports;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const hasClass = (node, name) => (node.props.className || '').split(/\s+/).includes(name);
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
const ui = load('src/components/admin/ui/index.tsx');

test('button forwards native props, handlers, children and object/callback refs', () => {
  const onClick = () => {}, onKeyDown = () => {};
  for (const ref of [{ current: null }, () => {}]) {
    const button = ui.AdminButton({ children: 'Сохранить', id: 'save', name: 'action', value: 'save',
      form: 'editor', title: 'Сохранить', 'aria-label': 'Сохранить', 'data-qa': 'save',
      onClick, onKeyDown, className: 'consumer-class' }, ref);
    assert.equal(button.type, 'button');
    for (const [key, value] of Object.entries({ id: 'save', name: 'action', value: 'save', form: 'editor',
      title: 'Сохранить', 'aria-label': 'Сохранить', 'data-qa': 'save', onClick, onKeyDown, ref })) {
      assert.equal(button.props[key], value, key);
    }
    assert(nodes(button).some(node => node.props.children === 'Сохранить') || button.props.children.includes('Сохранить'));
    assert(hasClass(button, 'consumer-class'));
    assert.equal(button.props.type, 'button', 'safe default inside forms');
    assert(!button.props.disabled);
    assert.equal(button.props['aria-busy'], undefined);
    assert(!Object.hasOwn(button.props, 'loading'));
  }
  for (const type of ['submit', 'reset', 'button']) assert.equal(ui.AdminButton({ type }).props.type, type);
});

test('button loading/disabled truth table and decorative progress indicator', () => {
  for (const loading of [false, true]) for (const disabled of [false, true]) {
    const button = ui.AdminButton({ loading, disabled, children: 'Сохранить' });
    assert.equal(button.props.disabled, loading || disabled);
    assert.equal(button.props['aria-busy'], loading ? true : undefined);
    const spinners = nodes(button).filter(node => hasClass(node, 'bs-spinner'));
    assert.equal(spinners.length, loading ? 1 : 0);
    if (loading) assert.equal(spinners[0].props['aria-hidden'], 'true');
  }
});

test('input/textarea/select preserve native semantics, refs and accessible descriptions', () => {
  for (const [component, tag] of [[ui.AdminInput, 'input'], [ui.AdminTextarea, 'textarea'], [ui.AdminSelect, 'select']]) {
    const ref = { current: null }, onChange = () => {};
    const field = component({ id: 'client', name: 'client', required: true, disabled: true, value: 'qa',
      'aria-describedby': 'client-description', 'aria-invalid': true, onChange, className: 'consumer-class' }, ref);
    assert.equal(field.type, tag);
    for (const [key, value] of Object.entries({ id: 'client', name: 'client', required: true, disabled: true,
      value: 'qa', 'aria-describedby': 'client-description', 'aria-invalid': true, onChange, ref })) assert.equal(field.props[key], value, key);
    assert(hasClass(field, 'bs-input') && hasClass(field, 'consumer-class'));
  }
});

test('field label association, optional hint, error precedence and alert semantics', () => {
  // The caller supplies aria-describedby/aria-invalid; AdminField does not clone the control.
  const child = ui.AdminInput({ id: 'client', 'aria-describedby': 'client-description' });
  for (const [hint, error, expected] of [[undefined, undefined, undefined], ['Подсказка', undefined, 'Подсказка'],
    [undefined, 'Ошибка', 'Ошибка'], ['Подсказка', 'Ошибка', 'Ошибка']]) {
    const tree = nodes(ui.AdminField({ id: 'client', label: 'Клиент', hint, error, children: child }));
    const label = tree.find(node => node.type === 'label');
    assert.equal(label.props.htmlFor, child.props.id);
    assert.equal(label.props.children, 'Клиент');
    assert(tree.includes(child), 'control identity preserved');
    const descriptions = tree.filter(node => node.props.id === 'client-description');
    assert.equal(descriptions.length, expected ? 1 : 0);
    if (expected) {
      assert.equal(descriptions[0].props.children, expected);
      assert.equal(descriptions[0].props.role, error ? 'alert' : undefined);
    }
  }
});

test('badges retain explicit text/aria labels for every tone; dot is decorative', () => {
  for (const tone of ['success', 'warning', 'destructive', 'info', 'neutral']) {
    const badge = ui.AdminBadge({ tone, children: 'Подтверждено', 'aria-label': 'Статус: подтверждено', className: 'consumer-class' });
    assert.equal(badge.type, 'span');
    assert.equal(badge.props['aria-label'], 'Статус: подтверждено');
    assert(badge.props.children.includes('Подтверждено'));
    assert(hasClass(badge, `bs-badge--${tone}`) && hasClass(badge, 'consumer-class'));
    const dot = nodes(badge).find(node => hasClass(node, 'bs-badge-dot'));
    assert.equal(dot.props['aria-hidden'], 'true');
  }
  assert(hasClass(ui.AdminBadge({ children: 'Статус' }), 'bs-badge--neutral'));
  const labels = { new: 'Новая', pending: 'Ожидает', confirmed: 'Подтверждена', cancelled: 'Отменена', completed: 'Завершена' };
  const { default: BookingStatusBadge } = load('src/components/admin/bookings/BookingStatusBadge.tsx', {
    '@/components/admin/ui': ui, '@/lib/api/bookings': { STATUS_LABELS: labels },
  });
  for (const [status, label] of Object.entries(labels)) {
    const badge = BookingStatusBadge({ status });
    assert.equal(badge.type, ui.AdminBadge);
    assert.equal(badge.props.children, label, 'consumer must supply a readable status');
  }
});

const css = postcss.parse(read('src/app/admin/design-system.css'));
function inKeyframes(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
  return false;
}
function scoped(selector) {
  // Every selector branch must start with an admin/bs class or a scoped :is().
  const rest = selector.replace(/^html\[data-admin-theme=[^\]]+\]\s+/, '');
  if (/^\.(?:admin-|bs-)[\w-]+/.test(rest)) return true;
  const match = rest.match(/^:is\(([^)]+)\)/);
  return Boolean(match && postcss.list.comma(match[1]).every(part => /^\.(?:admin-|bs-)[\w-]+(?:\s*>\s*div)?$/.test(part.trim())));
}
test('CSS rules/tokens remain namespaced, including media and portal selectors', () => {
  css.walkRules(rule => {
    if (!inKeyframes(rule)) for (const selector of postcss.list.comma(rule.selector)) assert(scoped(selector), `Unscoped selector: ${selector}`);
  });
  css.walkAtRules(rule => {
    assert(['media', 'keyframes'].includes(rule.name), `Review global CSS at-rule: @${rule.name}`);
    if (rule.name === 'keyframes') assert(/^bs-/.test(rule.params), 'animation names must be namespaced');
  });
  const tokens = [];
  css.walkDecls(/^--/, declaration => tokens.push(declaration));
  assert(tokens.length > 0);
  for (const token of tokens) assert(/^(--bs-|--admin-)/.test(token.prop), `Public token override: ${token.prop}`);
});

test('keyboard focus covers shell and portal; reduced motion suppresses animation/transition', () => {
  let focus = false, reduced = false;
  css.walkRules(rule => {
    if (!rule.selector.includes(':focus-visible')) return;
    const declarations = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    assert(rule.selector.includes('.admin-shell') && rule.selector.includes('.admin-confirm-dialog'));
    for (const control of ['button', 'a', 'input', 'select', 'textarea']) assert(new RegExp(`\\b${control}\\b`).test(rule.selector));
    assert(declarations.outline && !/^(none|0)(\s|$)/.test(declarations.outline));
    assert(parseFloat(declarations['outline-offset']) > 0);
    focus = true;
  });
  css.walkAtRules('media', media => {
    if (!/prefers-reduced-motion\s*:\s*reduce/.test(media.params)) return;
    media.walkRules(rule => {
      const declarations = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node]));
      if (declarations.animation?.value === 'none' && declarations.transition?.value === 'none') {
        assert(declarations.animation.important && declarations.transition.important);
        assert(rule.selector.includes('.admin-shell') && rule.selector.includes('.admin-confirm-dialog'));
        assert(rule.selector.includes('::before') && rule.selector.includes('::after'));
        assert.equal(declarations['scroll-behavior']?.value, 'auto');
        reduced = true;
      }
    });
  });
  assert(focus, 'visible keyboard focus required');
  assert(reduced, 'reduced motion override required');
});

test('public stylesheet matches branch HEAD and design CSS is imported only by admin', () => {
  const baseline = execFileSync('git', ['show', 'HEAD:src/app/globals.css'], { cwd: root, encoding: 'utf8' });
  assert.equal(read('src/app/globals.css').replace(/\r\n/g, '\n'), baseline.replace(/\r\n/g, '\n'), 'public globals changed relative to HEAD');
  const imports = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (/\.(tsx?|jsx?|css)$/.test(file) && /(?:import\s*[^;]*|@import\s*)['"][^'"]*design-system\.css['"]/.test(read(file))) imports.push(file);
    }
  }
  walk('src');
  assert(imports.includes('src/app/admin/layout.tsx'), 'admin layout must load design CSS');
  assert(imports.every(file => file.startsWith('src/app/admin/')), `Public import: ${imports.join(', ')}`);
});
test('semantic foreground/background pairs retain AA text contrast', () => {
  const sheet = postcss.parse(read('src/app/admin/design-system.css'));
  const tokens = new Map();
  sheet.nodes.find(node => node.type === 'rule').walkDecls(decl => tokens.set(decl.prop, decl.value));
  const luminance = value => {
    const hex = value.replace('#', '');
    const normalized = hex.length === 3 ? [...hex].map(c=>c+c).join('') : hex;
    const rgb = normalized.match(/../g).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  for (const [foreground,background] of [['primary','on-primary'],['muted','background'],['success','success-bg'],['warning','warning-bg'],['destructive','destructive-bg'],['info','info-bg']]) {
    const a=luminance(tokens.get('--bs-'+foreground)),b=luminance(tokens.get('--bs-'+background));
    const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert(contrast >= 4.5, `${foreground}/${background}: ${contrast.toFixed(2)}`);
  }
});
test('responsive dashboard keeps DOM order; legacy primary actions use semantic foreground', () => {
  const sheet = postcss.parse(read('src/app/admin/design-system.css'));
  let primaryForeground = false;
  sheet.walkRules(rule => {
    if(rule.selector.includes('.admin-dashboard-sidebar')) {
      rule.walkDecls(decl => assert(!['order','grid-row','grid-row-start'].includes(decl.prop), 'Do not reorder dashboard visually without changing DOM'));
    }
    if(rule.selector.includes('.admin-calendar-page button[class~=')) rule.walkDecls('color',decl => {primaryForeground ||= decl.value === 'var(--bs-on-primary)';});
  });
  assert(primaryForeground, 'Light/violet primary controls must use the matching foreground');
});
console.log(`Admin design system: ${passed} regression groups PASS (offline; no browser/DB/provider calls).`);
