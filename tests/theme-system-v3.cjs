// Grisha QA: offline VM and CSS contracts. No source writes or browser claims.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BASE = '1cc4919e747423657ef15849b50beefd742c5b0f';
const snapshots = new Map();
function read(file) { if (!snapshots.has(file)) snapshots.set(file, fs.readFileSync(path.join(root, file), 'utf8')); return snapshots.get(file); }
const source = read('src/lib/theme.ts'), css = read('src/app/theme-tokens.css');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
let passed = 0, failed = 0;
function test(name, run) { try { run(); passed++; console.log('VERIFIED ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
function harness(initial = {}, options = {}) {
  const values = new Map(Object.entries(initial)), attrs = new Map(), events = new Set(), metas = [];
  let writes = 0;
  const storage = {
    getItem(k) { if (options.blocked) throw Error('blocked'); return values.get(k) ?? null; },
    setItem(k, v) { if (options.blocked) throw Error('blocked'); writes++; values.set(k, v); },
  };
  const element = { style: {}, getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v) };
  const sandbox = { exports: {}, localStorage: storage,
    window: { addEventListener: (k, fn) => { assert.equal(k, 'storage'); events.add(fn); },
      removeEventListener: (k, fn) => events.delete(fn) },
    CSS: { supports: (k, v) => /^#[a-f\d]{6}$/i.test(v) },
    getComputedStyle: () => ({ getPropertyValue: () => attrs.get('data-theme') === 'chocolate-dark' ? '#1B1514' : '#F6F8F5' }) };
  if (!options.server) sandbox.document = { documentElement: element,
    querySelector: () => metas[0] || null, createElement: () => ({}), head: { appendChild: m => metas.push(m) } };
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { timeout: 1000 });
  const api = sandbox.exports;
  return { api, attrs, values, events, metas, storage, writes: () => writes,
    bootstrap: () => vm.runInContext(api.THEME_BOOTSTRAP, context, { timeout: 1000 }),
    sync: event => { for (const fn of events) fn({ storageArea: storage, ...event }); },
    check(theme) { assert.equal(api.getThemeSnapshot(), theme); assert.equal(attrs.get('data-theme'), theme);
      assert.equal(attrs.get('data-admin-theme'), theme); assert.equal(element.style.colorScheme, theme === 'chocolate-dark' ? 'dark' : 'light'); },
  };
}
test('bootstrap default/migration matrix', () => {
  const mapping = { violet: 'chocolate-dark', ironman: 'chocolate-dark', teal: 'emerald-light',
    light: 'emerald-light', newyear: 'emerald-light', 'chocolate-dark': 'chocolate-dark', 'emerald-light': 'emerald-light' };
  for (const [value, expected] of [[null, 'emerald-light'], ...Object.entries(mapping)]) {
    for (const key of ['theme', 'admin-theme']) {
      const h = harness(value === null ? {} : { [key]: value }); h.bootstrap(); h.check(expected);
      assert.equal(h.values.get('theme'), expected); assert.equal(h.events.size, 0);
    }
  }
});
test('canonical priority including invalid/empty canonical', () => {
  for (const theme of ['emerald-light', 'unknown', '']) {
    const h = harness({ theme, 'admin-theme': 'violet' }); h.bootstrap(); h.check('emerald-light');
  }
  const h = harness({ theme: 'chocolate-dark', 'admin-theme': 'teal' }); h.bootstrap(); h.check('chocolate-dark');
});
test('serverSnapshot without DOM', () => {
  const h = harness({}, { server: true });
  assert.equal(h.api.getServerThemeSnapshot(), 'emerald-light'); assert.equal(h.api.getThemeSnapshot(), 'emerald-light'); assert.equal(h.writes(), 0);
});
test('blocked storage and shared toggle', () => {
  for (const blocked of [true, false]) {
    const h = harness({}, { blocked }); h.bootstrap(); let a = 0, b = 0;
    const offA = h.api.subscribeTheme(() => a++), offB = h.api.subscribeTheme(() => b++);
    assert.equal(h.events.size, 1); a = b = 0;
    assert.equal(h.api.setTheme('chocolate-dark'), !blocked); h.check('chocolate-dark');
    assert.equal(a, 1); assert.equal(b, 1); h.api.toggleTheme(); h.check('emerald-light');
    assert.equal(a, 2); assert.equal(b, 2); offA(); assert.equal(h.events.size, 1); offB(); assert.equal(h.events.size, 0);
  }
});
test('storage sync/clear/foreign area/legacy ignore and theme-color', () => {
  const h = harness(); h.bootstrap(); const off = h.api.subscribeTheme(() => {});
  const writes = h.writes(); assert.equal(h.metas[0].content, '#F6F8F5');
  h.sync({ key: 'theme', newValue: 'chocolate-dark' }); h.check('chocolate-dark');
  assert.equal(h.metas[0].name, 'theme-color'); assert.equal(h.metas[0].content, '#1B1514');
  h.sync({ key: 'theme', newValue: 'emerald-light', storageArea: {} }); h.check('chocolate-dark');
  h.sync({ key: 'admin-theme', newValue: 'teal' }); h.check('chocolate-dark');
  h.sync({ key: null, newValue: null }); h.check('emerald-light');
  h.sync({ key: 'theme', newValue: 'violet', storageArea: null }); h.check('chocolate-dark');
  h.sync({ key: 'theme', newValue: null }); h.check('emerald-light');
  assert.equal(h.writes(), writes); assert.equal(h.metas.length, 1); off();
});
function palette(text, theme) {
  const tokens = {};
  postcss.parse(text).walkRules(rule => {
    if (!rule.selectors.some(s => s.trim() === ':root' || s.trim() === '[data-theme="' + theme + '"]')) return;
    rule.walkDecls(d => { if (d.prop.startsWith('--')) tokens[d.prop] = d.value; });
  });
  function resolve(name, seen = new Set()) {
    assert(!seen.has(name), 'circular token ' + name); assert(tokens[name], 'missing token ' + name);
    const ref = tokens[name].match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1], new Set([...seen, name])) : tokens[name];
  }
  return name => resolve('--' + name);
}
function luminance(hex) {
  assert(/^#[a-f\d]{6}$/i.test(hex), 'unsupported color ' + hex);
  return hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function aa(text) {
  let count = 0, minimum = Infinity;
  const errors = [];
  for (const theme of ['emerald-light', 'chocolate-dark']) {
    const color = palette(text, theme), pairs = [];
    for (const bg of ['background', 'surface', 'surface-elevated', 'surface-selected']) {
      for (const fg of ['foreground', 'foreground-secondary']) pairs.push([fg, bg, 4.5]);
      for (const fg of ['control-border', 'focus']) pairs.push([fg, bg, 3]);
    }
    for (const bg of ['primary', 'primary-hover', 'primary-pressed']) pairs.push(['primary-foreground', bg, 4.5]);
    pairs.push(['disabled-foreground', 'disabled', 4.5]); // Product requirement, despite WCAG inactive-control exemption.
    for (const status of ['success', 'warning', 'danger', 'information']) pairs.push([status, status + '-bg', 4.5]);
    for (const [fg, bg, required] of pairs) {
      const a = luminance(color(fg)), b = luminance(color(bg));
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (ratio < required) errors.push(theme + ' ' + fg + '/' + bg + ': ' + ratio.toFixed(3) + ' < ' + required);
      count++; minimum = Math.min(minimum, ratio);
    }
  }
  assert.equal(errors.length, 0, errors.join('; '));
  return { pairs: count, minimumRatio: +minimum.toFixed(3) };
}
test('WCAG text/buttons all states/status/control-border/focus', () => console.log(JSON.stringify(aa(css))));
test('contrast negative control rejects equal text/background', () => {
  assert.throws(() => aa(css.replace(/--foreground:\s*#[\da-f]+/i, '--foreground: #F6F8F5')), /foreground\/background/);
});

// Geometry AST: keep selectors, media/keyframes, order, typography, dimensions,
// border widths/styles and shadow offsets. Exclude explicit old-theme rules/colors.
const colorProp = /^(?:color|background(?:-color|-image)?|border(?:-[a-z-]+)?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color)$/;
const colorToken = /^--(?:(?:bs|admin)-)?(?:background|bg|surface|foreground|muted|primary|on-primary|brand|on-brand|border|success|warning|destructive|danger|info|information|text|accent|panel|topbar|sidebar|field|hover)(?:-|$)/;
function maskColors(value) {
  let result = '';
  for (let i = 0; i < value.length;) {
    const fn = value.slice(i).match(/^(?:rgba?|hsla?|oklch|oklab|color-mix|color|var)\(/i);
    if (fn) {
      let end = i + fn[0].length, depth = 1;
      for (; end < value.length && depth; end++) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; }
      const expression = value.slice(i, end);
      result += !expression.startsWith('var(') || /var\(--(?:.*(?:color|foreground|background|border|primary|accent|shadow-color)|focus(?:-soft)?\b|(?:bs|admin)-(?:muted|text|panel|surface|on-brand))/.test(expression) ? '<color>' : expression;
      i = end; continue;
    }
    const literal = value.slice(i).match(/^(?:#[\da-f]{3,8}\b|\b(?:transparent|currentColor|white|black)\b)/i);
    if (literal) { result += '<color>'; i += literal[0].length; } else result += value[i++];
  }
  return result.replace(/\s+/g, ' ').trim();
}
function geometry(text) {
  function visit(node) {
    if (node.type === 'comment') return null;
    if (node.type === 'rule' && /\[data-(?:admin-)?theme\s*=\s*["']?(?:violet|teal|light|newyear|ironman)["']?\]/.test(node.selector)) return null;
    if (node.type === 'decl') {
      if (colorProp.test(node.prop) || (colorToken.test(node.prop) &&
          !/(?:shadow|width|height|radius|size|space|gap|padding|margin|duration|motion|font|line|weight)/.test(node.prop))) return null;
      return ['decl', node.prop, maskColors(node.value), !!node.important];
    }
    const children = (node.nodes || []).map(visit).filter(Boolean);
    if (!children.length) return null;
    if (node.type === 'root') return ['root', children];
    if (node.type === 'rule') return ['rule', node.selector.replace(/\s+/g, ' ').trim(), children];
    if (node.type === 'atrule') return ['at', node.name, node.params, children];
    assert.fail('unsupported CSS node ' + node.type);
  }
  return visit(postcss.parse(text));
}
for (const file of ['admin.css', 'design-system.css', 'phase2.css', 'healthcare-shell.css', 'healthcare-dashboard.css', 'healthcare-calendar.css']) {
  test('admin geometry AST baseline 1cc: ' + file, () => {
    const relative = 'src/app/admin/' + file;
    const before = execFileSync('git', ['show', BASE + ':' + relative], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.deepEqual(geometry(read(relative)), geometry(before), file + ': geometry changed from 1cc');
  });
}
test('geometry negative controls spacing/border/shadow/media; colors excluded', () => {
  const original = '.a{padding:8px;border:1px solid #fff;box-shadow:0 2px 8px rgb(0 0 0 / 8%);color:#fff}@media(max-width:600px){.a{gap:4px}}';
  assert.deepEqual(geometry(original), geometry(original.replaceAll('#fff', '#123456')));
  for (const [before, after] of [['padding:8px', 'padding:9px'], ['1px solid', '2px solid'], ['0 2px 8px', '0 3px 8px'], ['600px', '601px']]) {
    assert.notDeepEqual(geometry(original), geometry(original.replace(before, after)));
  }
  assert.deepEqual(geometry('.a{outline:2px solid #fff}'), geometry('.a{outline:2px solid var(--focus)}'));
  assert.notDeepEqual(geometry('.a{--admin-sidebar-width:248px}'), geometry('.a{--admin-sidebar-width:250px}'));
});
let blocked = 0;
for (const [file, before] of snapshots) {
  if (fs.readFileSync(path.join(root, file), 'utf8') !== before) { blocked++; console.error('BLOCKED concurrent edit: ' + file); }
}
const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({ owner: 'Grisha', passed, failed, blocked, baseline: BASE,
  engineSha256: hash(source), tokensSha256: hash(css),
  limitations: 'NOT TESTED browser/cascade/hydration; old palette contracts intentionally not run' }));
process.exitCode = failed || blocked ? 1 : 0;
