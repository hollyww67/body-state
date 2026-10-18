// Offline palette / scope contracts. Browser visual QA remains a separate release gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const css = postcss.parse(read('src/app/quiet-precision.css'));
const palettes = {};
css.nodes.filter(n => n.type === 'rule' && [':root', '[data-theme="violet"]'].includes(n.selector)).forEach(rule => {
  palettes[rule.selector] = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]));
});
function luminance(hex) {
  const rgb = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test('public geometry never targets admin, room or operator login', () => {
  const surface = read('src/components/PublicSurface.tsx');
  for (const marker of ['"/admin"', '"/login"', '"/psychology/room"', '"/psychology-room/"']) assert(surface.includes(marker));
  css.walkRules(rule => {
    if ([":root", '[data-theme="violet"]'].includes(rule.selector)) {
      rule.walkDecls(d => assert(d.prop.startsWith('--qp-'), 'Only namespaced palette at root'));
    } else assert(rule.selector.includes('.quiet-public'), `Public rule leaks: ${rule.selector}`);
  });
});
test('six approved brand colors are represented without semantic text misuse', () => {
  const text = read('src/app/quiet-precision.css');
  for (const color of ['#C9C1E4', '#ECEBF3', '#F8F9F6', '#C7CBD2', '#6B6474', '#17212F']) assert(text.includes(color));
  assert.equal(palettes[':root']['--qp-brand'], '#C9C1E4');
});
test('light and violet normal text, links, CTA and semantic feedback meet AA', () => {
  for (const [theme, own] of Object.entries(palettes)) {
    const tokens = {...palettes[':root'], ...own};
    const pairs = [['text','background'], ['text','surface'], ['text-secondary','surface'], ['muted','background'], ['muted','surface'], ['link','surface'], ['on-brand','brand'], ['on-brand','brand-hover'], ['success','success-bg'], ['warning','warning-bg'], ['danger','danger-bg'], ['information','information-bg']];
    for (const [a, b] of pairs) {
      const ratio = contrast(tokens[`--qp-${a}`], tokens[`--qp-${b}`]);
      assert(ratio >= 4.5, `${theme} ${a}/${b} ${ratio.toFixed(2)}`);
    }
    assert(contrast(tokens['--qp-focus'], tokens['--qp-surface']) >= 3);
    assert(contrast(tokens['--qp-control-border'], tokens['--qp-surface']) >= 3);
  }
});
test('no backdrop decorations or fake success transport claims in the shared chrome', () => {
  const chrome = read('src/components/SiteChrome.tsx');
  assert(!chrome.includes('AnimatedBackground'));
  assert(!chrome.includes('Snowfall'));
  assert(!read('src/app/payment/fail/page.tsx').includes('/shop/cart'));
  assert(!read('src/app/payment/success/page.tsx').includes('safe to repeat'));
});
test('public serif is Cyrillic and admin font contract remains Manrope', () => {
  assert(read('src/app/layout.tsx').includes('Playfair_Display({ subsets: ["latin", "cyrillic"]'));
  assert(read('src/app/admin/design-system.css').includes('--bs-font: var(--font-manrope)'));
});
test('CMS image sources accept uploaded or HTTPS assets, never unsafe schemes or credentials', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('src/lib/public-image.ts'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports, URL});
  const source = exports.publicImageSource;
  for (const value of ['', null, 'javascript:alert(1)', 'data:image/svg+xml,test', '//evil.example/photo.png', 'http://example.org/photo.png', 'https://name:secret@example.org/photo.png', '/\\evil.example/photo.png', '/upload\n.png']) assert.equal(source(value), null);
  assert.equal(source('/uploads/approved.webp'), '/uploads/approved.webp');
  assert.equal(source('https://body-state.ru/uploads/approved.webp'), 'https://body-state.ru/uploads/approved.webp');
});
console.log(`${passed} Quiet Precision foundation groups passed`);
