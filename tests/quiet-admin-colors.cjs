// Offline, fixed-baseline color-only contract. No app, browser, DB, network or writes.
// Run: node tests/quiet-admin-colors.cjs
// Theme3 uses the central emerald/chocolate palette; legacy geometry stays pinned.
// This is not rendered-contrast or pixel-layout acceptance; main owns browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const base = '8d6aa48645651c7df827c9dab483cb69318696ed';
const file = 'src/app/admin/design-system.css';
const defaultSelector = '.admin-shell, .admin-confirm-dialog';
const violetSelector = 'html[data-admin-theme="violet"] :is(.admin-shell, .admin-confirm-dialog)';
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const git = (...args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).replace(/\r\n/g, '\n');
const baseline = postcss.parse(git('show', `${base}:${file}`));
const current = postcss.parse(read(file));
const themeCss = postcss.parse(read('src/app/theme-tokens.css'));
// Exact Theme3 migration snapshot, only for the two intentionally rewritten theme consumers.
const themeMigration = 'd1c0511cefb881a3fa6a62241e46f29c40a144f7';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const colors = new Set([
  '--bs-background', '--bs-surface', '--bs-surface-muted', '--bs-foreground', '--bs-muted',
  '--bs-primary', '--bs-primary-hover', '--bs-primary-soft', '--bs-on-primary',
  '--bs-brand-fill', '--bs-brand-hover', '--bs-on-brand', '--bs-border', '--bs-border-strong',
  '--bs-success', '--bs-success-bg', '--bs-warning', '--bs-warning-bg',
  '--bs-destructive', '--bs-destructive-bg', '--bs-info', '--bs-info-bg',
]);
const newColors = new Set(['--bs-brand-fill', '--bs-brand-hover', '--bs-on-brand']);
const mutableTokens = colors;
const aliases = {
  background: 'background', surface: 'surface', 'surface-muted': 'surface-elevated',
  foreground: 'foreground', muted: 'foreground-secondary', primary: 'primary',
  'primary-hover': 'primary-hover', 'primary-soft': 'surface-selected', 'on-primary': 'primary-foreground',
  'brand-fill': 'primary', 'brand-hover': 'primary-hover', 'on-brand': 'primary-foreground',
  border: 'border', 'border-strong': 'control-border', success: 'success', 'success-bg': 'success-bg',
  warning: 'warning', 'warning-bg': 'warning-bg', destructive: 'danger', 'destructive-bg': 'danger-bg',
  info: 'information', 'info-bg': 'information-bg',
};
const buttonRules = new Map([
  ['.admin-primary-action, .admin-quick-action.is-primary', new Set(['background', 'color'])],
  ['.bs-button--primary', new Set(['background', 'color'])],
  ['.bs-button--primary:hover:not(:disabled)', new Set(['background'])],
]);
let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log(`PASS ${name}`);
}
function rule(sheet, selector) {
  const matches = sheet.nodes.filter(node => node.type === 'rule' && node.selector === selector);
  assert.equal(matches.length, 1, `Unique top-level rule required: ${selector}`);
  return matches[0];
}
function declarations(node) {
  const result = {};
  for (const declaration of node.nodes.filter(node => node.type === 'decl')) {
    assert(!Object.hasOwn(result, declaration.prop), `Duplicate ${declaration.prop}`);
    result[declaration.prop] = declaration.value;
  }
  return result;
}
function allowedColor(declaration) {
  const parent = declaration.parent;
  if (parent.type !== 'rule' || parent.parent.type !== 'root') return false;
  if (parent.selector === defaultSelector) return mutableTokens.has(declaration.prop);
  if (parent.selector === violetSelector) return newColors.has(declaration.prop);
  return buttonRules.get(parent.selector)?.has(declaration.prop) || false;
}
// Keep selectors, declaration order, media queries, keyframes and every immutable
// value. Only the exact color-change locations above are removed before hashing.
function immutableAst(node) {
  if (node.type === 'comment') return null;
  if (node.type === 'rule' && node.selector === violetSelector) return null; // Replaced by central dark palette.
  if (node.type === 'decl') {
    if (allowedColor(node)) return null;
    let value = node.value;
    if (['--bs-shadow-sm', '--bs-shadow-md'].includes(node.prop))
      value = value.replace(/(?:rgb\([^)]*\)|color-mix\(.*\))$/, '<color>');
    if (node.prop === 'outline' && node.parent.selector.includes(':focus-visible'))
      value = value.replace(/var\(--(?:bs-primary|focus)\)/, '<color>');
    return ['decl', node.prop, value, Boolean(node.important)];
  }
  const children = (node.nodes || []).map(immutableAst).filter(Boolean);
  if (node.type === 'root') return ['root', children];
  if (node.type === 'rule') return ['rule', node.selector, children];
  if (node.type === 'atrule') return ['atrule', node.name, node.params, children];
  assert.fail(`Unexpected CSS node: ${node.type}`);
}
function colorContract(sheet) {
  assert.deepEqual(immutableAst(sheet), immutableAst(baseline), 'Non-allowlisted CSS/geometry changed');
  sheet.walkDecls(declaration => {
    if (!allowedColor(declaration)) return;
    assert(!declaration.important, 'Do not change cascade priority');
    const value = declaration.value;
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    const canonical = new Set(Object.values(aliases).map(name => '--' + name));
    assert(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) || (reference && (colors.has(reference[1]) || canonical.has(reference[1]))),
      `Only a literal color or color-token reference is allowed: ${declaration.prop}: ${value}`);
  });
  const defaults = declarations(rule(sheet, defaultSelector));
  for (const token of newColors) {
    assert(defaults[token], `Brand token must cover shell, portal and violet: ${token}`);
  }
  for (const [name, canonical] of Object.entries(aliases))
    assert.equal(defaults['--bs-' + name], 'var(--' + canonical + ')', 'Central alias: ' + name);
}
function palette(sheet, dark = false, central = themeCss) {
  const tokens = {}, theme = dark ? 'chocolate-dark' : 'emerald-light';
  central.walkRules(rule => {
    if (rule.selectors.some(s => s === ':root' || s === '[data-theme="' + theme + '"]'))
      rule.walkDecls(d => { if (d.prop.startsWith('--')) tokens[d.prop] = d.value; });
  });
  const inherited = Object.fromEntries(Object.entries(tokens).map(([name, value]) => [name, resolve(value, tokens)]));
  return { ...inherited, ...declarations(rule(sheet, defaultSelector)) };
}
function resolve(value, tokens, visited = new Set()) {
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (!reference) return value;
  const name = reference[1];
  assert(tokens[name] && !visited.has(name), `Missing or circular token: ${name}`);
  return resolve(tokens[name], tokens, new Set([...visited, name]));
}
function rgb(value) {
  assert(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value), `Unsupported contrast color: ${value}`);
  const raw = value.slice(1);
  return (raw.length === 3 ? [...raw].map(c => c + c).join('') : raw)
    .match(/../g).map(component => parseInt(component, 16) / 255);
}
function luminance(components) {
  return components.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function contrast(foreground, background, minimum, label, brightness = 1) {
  const a = luminance(rgb(foreground).map(c => c * brightness));
  const b = luminance(rgb(background).map(c => c * brightness));
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  assert(ratio >= minimum, `${label}: ${ratio.toFixed(3)} < ${minimum}`);
  return ratio;
}
function aa(sheet, central = themeCss) {
  for (const violet of [false, true]) {
    const tokens = palette(sheet, violet, central);
    const color = name => resolve(`var(--bs-${name})`, tokens);
    const theme = violet ? 'chocolate-dark' : 'emerald-light';
    const pairs = [
      ['foreground', 'background'], ['foreground', 'surface'], ['foreground', 'surface-muted'],
      ['muted', 'background'], ['muted', 'surface'], ['muted', 'surface-muted'], ['muted', 'primary-soft'],
      ['primary', 'background'], ['primary', 'surface'], ['primary-hover', 'primary-soft'],
      ['on-primary', 'primary'], ['on-primary', 'primary-hover'],
      ['on-brand', 'brand-fill'], ['on-brand', 'brand-hover'],
      ['success', 'success-bg'], ['warning', 'warning-bg'],
      ['destructive', 'destructive-bg'], ['info', 'info-bg'],
    ];
    for (const [fg, bg] of pairs) contrast(color(fg), color(bg), 4.5, `${theme}: ${fg}/${bg}`);
    // The existing :active filter darkens the whole control, including its text.
    for (const bg of ['brand-fill', 'brand-hover']) {
      contrast(color('on-brand'), color(bg), 4.5, `${theme}: active ${bg}`, .94);
    }
    for (const bg of ['background', 'surface', 'surface-muted']) {
      contrast(color('border-strong'), color(bg), 3, `${theme}: input boundary/${bg}`);
      contrast(color('primary'), color(bg), 3, `${theme}: focus/${bg}`);
    }
    // The baseline outline has a 3px offset: its adjacent color is the outer
    // surface, checked above, not the button fill (identical to the ring in violet).
    // Actual small agenda text also appears on new/pending/cancelled backgrounds.
    for (const bg of ['primary-soft', 'warning-bg', 'destructive-bg']) {
      for (const fg of ['foreground', 'muted']) contrast(color(fg), color(bg), 4.5, `${theme}: agenda ${fg}/${bg}`);
    }
  }
}

test('fixed 8d6 baseline: Theme3 color AST allowlist and identical immutable/geometry SHA256', () => {
  colorContract(current);
  const geometry = hash(immutableAst(current));
  assert.equal(geometry, hash(immutableAst(baseline)));
  console.log(`VERIFIED baseline=${base} immutable_geometry_sha256=${geometry}`);
});
test('central emerald/chocolate semantic aliases resolve for shell and portal', () => {
  for (const dark of [false, true]) {
    const tokens = palette(current, dark);
    for (const [name, canonical] of Object.entries(aliases)) {
      assert.equal(tokens['--bs-' + name], 'var(--' + canonical + ')');
      assert.equal(resolve(tokens['--bs-' + name], tokens), tokens['--' + canonical]);
    }
    assert.equal(resolve(tokens['--bs-brand-fill'], tokens), dark ? '#D2B0A1' : '#2F6B5B');
    assert.equal(resolve(tokens['--bs-on-brand'], tokens), dark ? '#221816' : '#FFFFFF');
    assert.equal(tokens['--admin-accent'], 'var(--bs-primary)');
    assert.equal(tokens['--admin-text'], 'var(--bs-foreground)');
  }
});
test('brand button selectors use semantic Theme3 fill/foreground; legacy primary controls retain primary/on-primary', () => {
  for (const selector of ['.admin-primary-action, .admin-quick-action.is-primary', '.bs-button--primary']) {
    const values = declarations(rule(current, selector));
    assert.equal(values.background, 'var(--bs-brand-fill)');
    assert.equal(values.color, 'var(--bs-on-brand)');
  }
  assert.equal(declarations(rule(current, '.bs-button--primary:hover:not(:disabled)')).background, 'var(--bs-brand-hover)');
  assert.equal(declarations(rule(current, '.bs-switch:checked')).background, 'var(--bs-primary)');
  assert.equal(declarations(rule(current, '.bs-check'))['accent-color'], 'var(--bs-primary)');
  assert.equal(declarations(rule(current, '.admin-calendar-page button[class~="bg-[var(--bs-primary)]"]')).color,
    'var(--bs-on-primary)');
});
test('central chocolate palette is explicit and does not inherit emerald brand colors', () => {
  const dark = palette(current, true), light = palette(current);
  for (const name of ['background', 'foreground', 'brand-fill', 'on-brand']) {
    assert.notEqual(resolve(dark['--bs-' + name], dark), resolve(light['--bs-' + name], light));
  }
  assert(!current.nodes.some(node => node.type === 'rule' && node.selector === violetSelector));
  for (const [brand, legacy] of [['brand-fill', 'primary'], ['brand-hover', 'primary-hover'], ['on-brand', 'on-primary']])
    assert.equal(resolve(dark['--bs-' + brand], dark), resolve(dark['--bs-' + legacy], dark));
});
test('emerald/chocolate text, brand hover/pressed, portal tokens, focus, boundaries and agenda retain contrast', () => aa(current));
test('portal coverage, focus geometry, disabled states and reduced-motion rules stay baseline-exact', () => {
  assert(defaultSelector.includes('.admin-confirm-dialog'));
  for (const dark of [false, true]) for (const token of colors) assert(palette(current, dark)[token]);
  for (const selector of [
    ':is(.admin-shell,.admin-confirm-dialog) :is(button, a, input, select, textarea, summary):focus-visible',
    '.bs-button:disabled', '.bs-input:disabled', '.bs-switch:disabled, .bs-check:disabled',
  ]) assert.deepEqual(immutableAst(rule(current, selector)), immutableAst(rule(baseline, selector)));
  const motion = sheet => sheet.nodes.filter(node => node.type === 'atrule' && node.params === '(prefers-reduced-motion: reduce)')
    .map(immutableAst);
  assert.deepEqual(motion(current), motion(baseline));
});
function settingsBusiness(text) {
  const ast = ts.createSourceFile('settings.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'AdminSettingsPage');
  assert(page?.body, 'Settings page function required');
  const themeNames = new Set(['theme', 'saved', 'themeBusy', 'themeError', 'saveTheme']);
  const statements = page.body.statements.filter(n => {
    if (ts.isReturnStatement(n)) return false;
    if (ts.isVariableStatement(n)) {
      const names = n.declarationList.declarations.map(d => ts.isIdentifier(d.name) ? d.name.text : d.name.elements[0].name.text);
      if (names.every(name => themeNames.has(name))) return false;
    }
    return !n.getText(ast).includes('fetch("/api/theme")');
  }).map(n => n.getText(ast));
  const cards = [];
  function visit(n) {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'AdminCard') {
      const text = n.getText(ast);
      if (!text.includes('<Palette ')) cards.push(text);
    }
    ts.forEachChild(n, visit);
  }
  visit(page);
  assert.equal(cards.length, 2, 'Shop and password cards retained');
  return { statements, cards };
}
test('settings shop/password state, effects, handlers and cards remain pre-Theme3 exact', () => {
  const name = 'src/app/admin/settings/page.tsx';
  const before = settingsBusiness(git('show', base + ':' + name));
  assert.deepEqual(settingsBusiness(read(name)), before);
  assert.notDeepEqual(settingsBusiness(read(name).replace('/api/admin/site-visibility', '/api/admin/WRONG')), before);
  assert.notDeepEqual(settingsBusiness(read(name).replace('type={showPasswords', 'type={brokenFlag')), before);
});
function adminImmutable(text) {
  const sheet = postcss.parse(text);
  const rootColors = new Set(['--admin-bg', '--admin-panel', '--admin-panel-soft', '--admin-border',
    '--admin-text', '--admin-muted', '--admin-accent', '--admin-accent-strong', '--admin-accent-soft',
    '--admin-topbar', '--admin-sidebar', '--admin-field', '--admin-hover', '--admin-panel-rgb']);
  const removedReverseAliases = new Set(['--bg', '--bg-secondary', '--foreground', '--foreground-secondary',
    '--primary', '--primary-light', '--primary-muted', '--border']);
  sheet.walkDecls(d => {
    if (d.parent.type !== 'rule') return;
    if (d.parent.selector === '.admin-shell' && removedReverseAliases.has(d.prop)) { d.remove(); return; }
    if (d.prop === 'color' || (d.parent.selector === ':root' && rootColors.has(d.prop)) ||
        (d.parent.selector === '.admin-activity-row:hover' && d.prop === 'background')) d.value = '<color>';
    if (d.parent.selector === ':root' && d.prop === '--admin-shadow')
      d.value = d.value.replace(/rgba\([^)]*\)|var\(--shadow-color\)/g, '<color>');
  });
  return sheet.toString();
}
test('all other admin CSS/TSX, layout imports, shared theme consumers and portal lifecycle remain pinned', () => {
  const files = git('ls-tree', '-r', '--name-only', base, '--', 'src/app/admin', 'src/components/admin')
    .trim().split('\n').filter(Boolean);
  assert(files.length > 20);
  for (const name of files.filter(name => name !== file)) {
    const intentionalThemeUi = ['src/app/admin/AdminThemeToggle.tsx', 'src/app/admin/settings/page.tsx'].includes(name);
    if (name === 'src/app/admin/admin.css') {
      // Exact root color migrations/reverse-alias removal; all other bytes stay pinned.
      assert.equal(adminImmutable(read(name)), adminImmutable(git('show', base + ':' + name)), name);
    } else assert.equal(read(name), git('show', (intentionalThemeUi ? themeMigration : base) + ':' + name), name);
  }
  assert(!fs.existsSync(path.join(root, 'src/app/admin/quiet-colors.css')), 'No competing theme file required');
});
test('admin.css migration exclusions retain geometry and do not hide non-color mutations', () => {
  const text = read('src/app/admin/admin.css'), original = adminImmutable(text);
  for (const [before, after] of [['min-height: 100vh', 'min-height: 200vh'],
    ['0 12px 35px', '0 14px 35px'], ['min-height: 64px', 'min-height: 65px']]) {
    assert(text.includes(before), 'Mutation target exists: ' + before);
    assert.notEqual(adminImmutable(text.replace(before, after)), original);
  }
});
test('mutation guards reject geometry, font, motion, selectors, priority and non-color substitutions', () => {
  const mutate = change => { const sheet = current.clone(); change(sheet); return sheet; };
  for (const property of ['min-height', 'padding', 'font', 'transition']) {
    assert.throws(() => colorContract(mutate(sheet => rule(sheet, '.bs-button').walkDecls(property, d => { d.value = '999px'; }))));
  }
  assert.throws(() => colorContract(mutate(sheet => rule(sheet, defaultSelector).walkDecls('--bs-space-1', d => { d.value = '8px'; }))));
  assert.throws(() => colorContract(mutate(sheet => sheet.append('body { color: #17212f; }'))));
  assert.throws(() => colorContract(mutate(sheet => rule(sheet, defaultSelector).selector = '.admin-shell')));
  assert.throws(() => colorContract(mutate(sheet => rule(sheet, '.bs-button--primary').walkDecls('color', d => { d.important = true; }))));
  for (const bad of ['url(https://invalid.example/image)', 'var(--bs-space-1)', 'linear-gradient(#fff,#000)']) {
    assert.throws(() => colorContract(mutate(sheet => rule(sheet, defaultSelector).walkDecls('--bs-brand-fill', d => { d.value = bad; }))));
  }
});
test('shadow offsets, focus outline width and token cycles have negative controls', () => {
  const shadow = current.clone();
  rule(shadow, defaultSelector).walkDecls('--bs-shadow-sm', d => { d.value = d.value.replace('0 1px 3px', '0 2px 3px'); });
  assert.throws(() => colorContract(shadow));
  const focus = current.clone();
  rule(focus, ':is(.admin-shell,.admin-confirm-dialog) :is(button, a, input, select, textarea, summary):focus-visible')
    .walkDecls('outline', d => { d.value = '4px solid var(--focus)'; });
  assert.throws(() => colorContract(focus));
  assert.throws(() => resolve('var(--a)', { '--a': 'var(--b)', '--b': 'var(--a)' }), /circular token/);
});
test('contrast/theme mutation guards reject unreadable chocolate text, weak focus and missing aliases', () => {
  const white = current.clone();
  rule(white, defaultSelector).walkDecls('--bs-on-brand', d => { d.value = '#fff'; });
  assert.throws(() => aa(white));
  const focus = current.clone();
  rule(focus, defaultSelector).walkDecls('--bs-primary', d => { d.value = '#c9c1e4'; });
  assert.throws(() => aa(focus));
  const missing = current.clone();
  rule(missing, defaultSelector).walkDecls('--bs-on-brand', d => d.remove());
  assert.throws(() => colorContract(missing));
  const inherited = themeCss.clone();
  inherited.walkRules(r => { if (r.selector === '[data-theme="chocolate-dark"]') r.walkDecls('--primary-foreground', d => d.remove()); });
  assert.throws(() => aa(current, inherited));
});
console.log('Quiet admin colors: ' + passed + ' groups PASS (offline; no app/network/provider execution).');
console.log('NOT TESTED rendered cascade/contrast, browser geometry/focus and visual reference fidelity; main owns browser QA.');
