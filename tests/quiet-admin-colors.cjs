// Offline, fixed-baseline color-only contract. No app, browser, DB, network or writes.
// Run: node tests/quiet-admin-colors.cjs
// Intentionally deferred: teal calendar utilities, emerald shop switches and legacy
// admin.css gradients/focus overrides. Their TSX/CSS files are outside this change.
// This is not rendered-contrast or pixel-layout acceptance; main owns browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');

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
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const colors = new Set([
  '--bs-background', '--bs-surface', '--bs-surface-muted', '--bs-foreground', '--bs-muted',
  '--bs-primary', '--bs-primary-hover', '--bs-primary-soft', '--bs-on-primary',
  '--bs-brand-fill', '--bs-brand-hover', '--bs-on-brand', '--bs-border', '--bs-border-strong',
  '--bs-success', '--bs-success-bg', '--bs-warning', '--bs-warning-bg',
  '--bs-destructive', '--bs-destructive-bg', '--bs-info', '--bs-info-bg',
]);
const newColors = new Set(['--bs-brand-fill', '--bs-brand-hover', '--bs-on-brand']);
const mutableTokens = new Set([
  '--bs-background', '--bs-surface-muted', '--bs-muted', '--bs-primary', '--bs-primary-hover',
  '--bs-primary-soft', '--bs-border', '--bs-border-strong', ...newColors,
]);
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
  if (node.type === 'decl') {
    if (allowedColor(node)) return null;
    return ['decl', node.prop, node.value, Boolean(node.important)];
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
    const reference = value.match(/^var\((--bs-[\w-]+)\)$/);
    assert(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) || (reference && colors.has(reference[1])),
      `Only a literal color or color-token reference is allowed: ${declaration.prop}: ${value}`);
  });
  const defaults = declarations(rule(sheet, defaultSelector));
  const violet = declarations(rule(sheet, violetSelector));
  for (const token of newColors) {
    assert(defaults[token] && violet[token], `Brand token must cover shell, portal and violet: ${token}`);
  }
}
function palette(sheet, violet = false) {
  return {
    ...declarations(rule(sheet, defaultSelector)),
    ...(violet ? declarations(rule(sheet, violetSelector)) : {}),
  };
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
function aa(sheet) {
  for (const violet of [false, true]) {
    const tokens = palette(sheet, violet);
    const color = name => resolve(`var(--bs-${name})`, tokens);
    const theme = violet ? 'violet' : 'light';
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

test('fixed 8d6 baseline: color AST allowlist and identical immutable/geometry SHA256', () => {
  colorContract(current);
  const geometry = hash(immutableAst(current));
  assert.equal(geometry, hash(immutableAst(baseline)));
  console.log(`VERIFIED baseline=${base} immutable_geometry_sha256=${geometry}`);
});
test('Quiet Precision palette separates brand fills from accessible primary text', () => {
  const tokens = palette(current);
  for (const [name, expected] of Object.entries({
    background: '#f8f9f6', surface: '#fff', 'surface-muted': '#ecebf3',
    foreground: '#17212f', muted: '#6b6474', primary: '#645080',
    'primary-soft': '#ecebf3', 'brand-fill': '#c9c1e4', 'on-brand': '#17212f', border: '#c7cbd2',
    'on-primary': '#fff',
  })) assert.equal(tokens[`--bs-${name}`], expected);
  assert.equal(tokens['--admin-accent'], 'var(--bs-primary)');
  assert.equal(tokens['--admin-text'], 'var(--bs-foreground)');
});
test('brand button selectors use dark-on-lilac; legacy primary controls retain primary/on-primary', () => {
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
test('violet existing declarations and effective primary button colors remain unchanged', () => {
  const before = declarations(rule(baseline, violetSelector));
  const after = declarations(rule(current, violetSelector));
  for (const [name, value] of Object.entries(before)) assert.equal(after[name], value, name);
  const oldPalette = palette(baseline, true), newPalette = palette(current, true);
  for (const [brand, legacy] of [['brand-fill', 'primary'], ['brand-hover', 'primary-hover'], ['on-brand', 'on-primary']]) {
    assert.equal(resolve(`var(--bs-${brand})`, newPalette), resolve(`var(--bs-${legacy})`, oldPalette));
  }
});
test('light/violet text, brand hover/pressed, portal tokens, focus, boundaries and agenda retain contrast', () => aa(current));
test('portal coverage, focus geometry, disabled states and reduced-motion rules stay baseline-exact', () => {
  assert(defaultSelector.includes('.admin-confirm-dialog') && violetSelector.includes('.admin-confirm-dialog'));
  for (const selector of [
    ':is(.admin-shell,.admin-confirm-dialog) :is(button, a, input, select, textarea, summary):focus-visible',
    '.bs-button:disabled', '.bs-input:disabled', '.bs-switch:disabled, .bs-check:disabled',
  ]) assert.deepEqual(declarations(rule(current, selector)), declarations(rule(baseline, selector)));
  const motion = sheet => sheet.nodes.filter(node => node.type === 'atrule' && node.params === '(prefers-reduced-motion: reduce)')
    .map(immutableAst);
  assert.deepEqual(motion(current), motion(baseline));
});
test('all other admin CSS/TSX, layout imports, theme persistence and portal lifecycle match baseline', () => {
  const files = git('ls-tree', '-r', '--name-only', base, '--', 'src/app/admin', 'src/components/admin')
    .trim().split('\n').filter(Boolean);
  assert(files.length > 20);
  for (const name of files.filter(name => name !== file)) assert.equal(read(name), git('show', `${base}:${name}`), name);
  assert(!fs.existsSync(path.join(root, 'src/app/admin/quiet-colors.css')), 'No competing theme file required');
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
test('contrast/violet mutation guards reject white-on-lilac and accidental theme inheritance', () => {
  const white = current.clone();
  rule(white, defaultSelector).walkDecls('--bs-on-brand', d => { d.value = '#fff'; });
  assert.throws(() => aa(white));
  const focus = current.clone();
  rule(focus, defaultSelector).walkDecls('--bs-primary', d => { d.value = '#c9c1e4'; });
  assert.throws(() => aa(focus));
  const missing = current.clone();
  rule(missing, violetSelector).walkDecls('--bs-on-brand', d => d.remove());
  assert.throws(() => colorContract(missing));
});
console.log(`Quiet admin colors: ${passed} groups PASS (offline; no app/network/provider execution).`);
console.log('NOT TESTED rendered cascade/contrast, browser geometry/focus and visual reference fidelity; main owns browser QA.');
