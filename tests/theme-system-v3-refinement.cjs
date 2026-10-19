// Grisha QA: TZ 3af0772b; offline/read-only contract against immutable 32f53ae.
// Run: node tests/theme-system-v3-refinement.cjs
// Static CSS token/cascade model; browser/physical PWA/zoom remain separate gates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const BASE = '32f53ae76f6e9705ee94030a07930abf3a85fe4f';
const FILE = 'src/app/theme-tokens.css';
const DARK = '[data-theme="chocolate-dark"]';
const snapshots = new Map();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\r\n/g, '\n');
function read(file) {
  if (!snapshots.has(file)) snapshots.set(file, fs.readFileSync(path.join(root, file)));
  return snapshots.get(file).toString('utf8').replace(/\r\n/g, '\n');
}
const baseline = git('show', BASE + ':' + FILE), current = read(FILE);
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('VERIFIED ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function ast(node) {
  if (node.type === 'comment') return null;
  if (node.type === 'decl') return ['decl', node.prop, node.value, !!node.important];
  const children = (node.nodes || []).map(ast).filter(Boolean);
  if (node.type === 'root') return ['root', children];
  if (node.type === 'rule') return ['rule', node.selector, children];
  if (node.type === 'atrule') return ['at', node.name, node.params, children];
  assert.fail('Unexpected CSS node ' + node.type);
}
const approved = {
  '--background': '#1F1917', '--surface': '#302622', '--surface-rgb': '48, 38, 34',
  '--surface-elevated': '#3A2E29', '--surface-selected': '#44352E', '--primary-pressed': '#C49C8B',
};
function expectedSheet() {
  const sheet = postcss.parse(baseline);
  const dark = sheet.nodes.find(n => n.type === 'rule' && n.selector === DARK);
  for (const [name, value] of Object.entries(approved)) {
    const declaration = dark.nodes.find(n => n.type === 'decl' && n.prop === name);
    assert(declaration, 'Baseline token exists: ' + name); declaration.value = value;
  }
  dark.insertAfter(dark.nodes.find(n => n.prop === '--foreground-secondary'),
    postcss.decl({ prop: '--foreground-muted', value: '#B89F92' }));
  const body = sheet.nodes.find(n => n.type === 'rule' && n.selector === 'body');
  sheet.insertBefore(body, postcss.parse(DARK + '{--muted:var(--foreground-muted);--qp-muted:var(--foreground-muted)}').nodes[0]);
  sheet.insertBefore(body, postcss.parse(DARK + ' .quiet-public{--surface-elevated:var(--qp-surface-elevated);--muted:var(--qp-muted)}').nodes[0]);
  return sheet;
}
function exactRefinement(text) {
  // Every other token, selector, declaration/order, priority, noncolor rule and geometry stays exact.
  assert.deepEqual(ast(postcss.parse(text)), ast(expectedSheet()), 'Only exact approved dark refinement is allowed');
}
function tokensFor(text, theme) {
  const tokens = {};
  // Public inherited geometry tokens live in the unchanged QP foundation sheet.
  postcss.parse(read('src/app/quiet-precision.css')).walkRules(rule => {
    if (rule.parent.type !== 'root' || rule.selector !== ':root') return;
    for (const d of rule.nodes.filter(n => n.type === 'decl' && n.prop.startsWith('--'))) tokens[d.prop] = d.value;
  });
  postcss.parse(text).walkRules(rule => {
    if (rule.parent.type !== 'root' || !rule.selectors.some(s => s === ':root' || s === '[data-theme="' + theme + '"]')) return;
    for (const d of rule.nodes.filter(n => n.type === 'decl' && n.prop.startsWith('--'))) tokens[d.prop] = d.value;
  });
  return tokens;
}
function compute(tokens) {
  const cache = {}, stack = [];
  function resolve(name) {
    assert(!stack.includes(name), 'Token cycle: ' + [...stack, name].join(' -> '));
    assert(Object.hasOwn(tokens, name), 'Missing token ' + name);
    if (Object.hasOwn(cache, name)) return cache[name];
    stack.push(name);
    const value = tokens[name].replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, ref) => resolve(ref));
    assert(!value.includes('var('), 'Unsupported var expression ' + value);
    stack.pop(); return cache[name] = value;
  }
  return Object.fromEntries(Object.keys(tokens).map(name => [name, resolve(name)]));
}
function publicTokens(text, theme) {
  // Parent custom properties inherit computed values, not their original var expressions.
  const inherited = compute(tokensFor(text, theme)), own = {};
  for (const sheet of [postcss.parse(read('src/app/quiet-precision.css')), postcss.parse(text)]) {
    sheet.walkRules(rule => {
      if (rule.parent.type !== 'root' || !rule.selectors.some(s => s === '.quiet-public' ||
          s === '[data-theme="' + theme + '"] .quiet-public')) return;
      for (const d of rule.nodes.filter(n => n.type === 'decl' && n.prop.startsWith('--'))) own[d.prop] = d.value;
    });
  }
  return compute({ ...inherited, ...own });
}
function luminance(hex) {
  assert(/^#[\da-f]{6}$/i.test(hex), 'Unsupported contrast color ' + hex);
  return hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
}
function ratio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function darkAA(text) {
  const tokens = compute(tokensFor(text, 'chocolate-dark'));
  const surfaces = ['background', 'surface', 'surface-elevated', 'surface-selected'];
  let minimumText = Infinity, pairs = 0;
  for (const bg of surfaces) for (const fg of ['foreground', 'foreground-secondary', 'foreground-muted']) {
    const value = ratio(tokens['--' + fg], tokens['--' + bg]);
    assert(value >= 4.5, fg + '/' + bg + ': ' + value.toFixed(3) + ' < 4.5');
    minimumText = Math.min(minimumText, value); pairs++;
  }
  for (const bg of ['primary', 'primary-hover', 'primary-pressed']) {
    const value = ratio(tokens['--primary-foreground'], tokens['--' + bg]);
    assert(value >= 4.5, 'button/' + bg + ': ' + value.toFixed(3) + ' < 4.5'); pairs++;
  }
  for (const fg of ['success', 'warning', 'danger', 'information']) {
    assert(ratio(tokens['--' + fg], tokens['--' + fg + '-bg']) >= 4.5, fg + ' semantic AA'); pairs++;
  }
  const publicValues = publicTokens(text, 'chocolate-dark');
  assert.equal(publicValues['--muted'], tokens['--foreground-muted']);
  assert.equal(publicValues['--surface-elevated'], tokens['--surface-elevated']);
  return { pairs, minimumText: +minimumText.toFixed(3),
    mutedSelected: +ratio(tokens['--foreground-muted'], tokens['--surface-selected']).toFixed(3),
    pressed: +ratio(tokens['--primary-foreground'], tokens['--primary-pressed']).toFixed(3) };
}
const inventory = git('ls-tree', '-r', BASE, '--', 'src').trim().split('\n').map(line => {
  const [meta, file] = line.split('\t'); return { file, blob: meta.split(' ')[2] };
});
function unchangedSource(overrides = {}) {
  assert(inventory.length > 20);
  for (const { file, blob } of inventory) {
    if (file === FILE) continue;
    const text = Object.hasOwn(overrides, file) ? overrides[file] : read(file);
    const content = Buffer.from(text);
    const actual = createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
    assert.equal(actual, blob, 'Source changed outside palette: ' + file);
  }
}
test('32f53ae exact dark allowlist; all other CSS including geometry unchanged', () => exactRefinement(current));
test('32f53ae complete light computed root/public palette unchanged', () => {
  assert.deepEqual(compute(tokensFor(current, 'emerald-light')), compute(tokensFor(baseline, 'emerald-light')));
  assert.deepEqual(publicTokens(current, 'emerald-light'), publicTokens(baseline, 'emerald-light'));
  assert(!Object.hasOwn(tokensFor(current, 'emerald-light'), '--foreground-muted'));
});
test('32f53ae every other src blob unchanged, including engine/API/admin geometry', () => {
  const actual = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'src').trim().split('\n').sort();
  assert.deepEqual(actual, inventory.map(n => n.file).sort(), 'Source file inventory unchanged');
  unchangedSource();
});
test('dark muted/secondary/selected/pressed and semantic statuses meet AA', () => console.log(JSON.stringify(darkAA(current))));
test('dark semantic roles and tonal hierarchy stay distinct', () => {
  const t = compute(tokensFor(current, 'chocolate-dark'));
  const distinct = names => assert.equal(new Set(names.map(n => t['--' + n])).size, names.length, 'Distinct roles ' + names);
  distinct(['foreground', 'foreground-secondary', 'foreground-muted']);
  distinct(['background', 'surface', 'surface-elevated', 'surface-selected']);
  distinct(['primary', 'primary-hover', 'primary-pressed', 'success', 'warning', 'danger', 'information']);
  for (const names of [['background', 'surface', 'surface-elevated', 'surface-selected'],
    ['primary-pressed', 'primary', 'primary-hover'], ['foreground-muted', 'foreground-secondary', 'foreground']])
    for (let i = 1; i < names.length; i++) assert(luminance(t['--' + names[i]]) > luminance(t['--' + names[i - 1]]), 'Tonal order ' + names);
});
test('negative controls reject light drift, nonapproved dark changes, geometry and engine edits', () => {
  for (const [before, after] of [['#F6F8F5', '#F6F8F4'], ['#1F1917', '#201917'], ['#9D8275', '#9D8276']]) {
    assert(current.includes(before)); assert.throws(() => exactRefinement(current.replace(before, after)));
  }
  assert.throws(() => exactRefinement(current + '\n.quiet-public{padding:1px}'));
  assert.throws(() => unchangedSource({ 'src/lib/theme.ts': read('src/lib/theme.ts') + '\n' }), /Source changed outside palette/);
});
test('negative controls reject low-contrast muted/pressed and lost dark-only elevated alias', () => {
  assert.throws(() => darkAA(current.replace('#B89F92', '#44352E')), /foreground-muted/);
  assert.throws(() => darkAA(current.replace('#C49C8B', '#221816')), /button\/primary-pressed/);
  assert.throws(() => exactRefinement(current.replace('--surface-elevated: var(--qp-surface-elevated)', '--surface-elevated: var(--qp-surface)')));
  assert.throws(() => compute({ '--a': 'var(--b)', '--b': 'var(--a)' }), /Token cycle/);
});
let blocked = 0;
for (const [file, before] of snapshots) if (!fs.readFileSync(path.join(root, file)).equals(before)) {
  blocked++; console.error('BLOCKED concurrent source edit: ' + file);
}
console.log(JSON.stringify({ owner: 'Grisha', baseline: BASE, passed, failed, blocked,
  limitations: 'NOT TESTED rendered browser/physical PWA/zoom; no build or source writes' }));
process.exitCode = failed || blocked ? 1 : 0;
