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
const themeCss = postcss.parse(read('src/app/theme-tokens.css'));
const palettes = {};
for (const theme of ['emerald-light', 'chocolate-dark']) {
  const tokens = {};
  themeCss.walkRules(rule => {
    if (rule.selectors.some(s => s === ':root' || s === '[data-theme="' + theme + '"]'))
      rule.walkDecls(d => { if (d.prop.startsWith('--')) tokens[d.prop] = d.value; });
  });
  function resolve(name, seen = new Set()) {
    assert(tokens[name] && !seen.has(name), 'Missing/circular token: ' + name);
    const ref = tokens[name].match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1], new Set([...seen, name])) : tokens[name];
  }
  palettes[theme] = Object.fromEntries(Object.keys(tokens).map(name => [name, resolve(name)]));
}
function luminance(hex) {
  assert(/^#[\da-f]{6}$/i.test(hex), 'Unsupported contrast color: ' + hex);
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
    if (rule.selector === ':root') {
      rule.walkDecls(d => assert(d.prop.startsWith('--qp-'), 'Only namespaced palette at root'));
    } else assert(rule.selector.includes('.quiet-public'), `Public rule leaks: ${rule.selector}`);
  });
});
test('approved Theme3 colors come from central emerald/chocolate semantic tokens', () => {
  const expected = {
    'emerald-light': { brand: '#2F6B5B', mist: '#E7EFEB', background: '#F6F8F5', 'cool-grey': '#DCE5E0', muted: '#526760', text: '#172A26' },
    'chocolate-dark': { brand: '#D2B0A1', mist: '#3A2E29', background: '#1F1917', 'cool-grey': '#52413B', muted: '#B89F92', text: '#F7EFE7' },
  };
  for (const [theme, values] of Object.entries(expected))
    for (const [name, value] of Object.entries(values)) assert.equal(palettes[theme]['--qp-' + name], value);
  assert(!read('src/app/quiet-precision.css').match(/--qp-(?:brand|text|background):\s*#/));
});
test('emerald/chocolate normal text, links, CTA and semantic feedback meet AA', () => {
  for (const [theme, tokens] of Object.entries(palettes)) {
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
test('promo action uses semantic fill/foreground independently of links in both themes', () => {
  const promo = read('src/components/PromoCodeField.tsx');
  assert(promo.includes('var(--qp-promo-fill, var(--primary))'));
  assert(promo.includes('var(--qp-promo-text, #fff)'));
  const tokens = read('src/app/quiet-precision.css');
  assert(tokens.includes('--qp-promo-fill: var(--qp-brand); --qp-promo-text: var(--qp-on-brand)'));
  assert(tokens.includes('.quiet-public .qp-promo button { min-width: 44px; min-height: 44px; }'));
});
test('booking reference retains editorial geometry and semantic AA CTA without touching admin', () => {
  const booking = read('src/components/booking-quiet.css');
  assert(booking.includes('font-size: clamp(40px, 5vw, 46px)'));
  assert(booking.includes('.qb-heading .qb-heading-service { max-width: 12ch; }'));
  assert(booking.includes('.quiet-public .qb-actions .qb-next { background: var(--qp-brand); color: var(--qp-on-brand); }'));
  assert(booking.includes('.quiet-public .qb-actions .qb-next:hover:not(:disabled) { background: var(--qp-brand-hover); color: var(--qp-on-brand); }'));
  for (const tokens of Object.values(palettes))
    for (const bg of ['brand', 'brand-hover', 'brand-pressed'])
      assert(contrast(tokens['--qp-on-brand'], tokens['--qp-' + bg]) >= 4.5);
});
test('review fields have associated labels and promo errors use semantic announced feedback', () => {
  const reviews = read('src/app/reviews/page.tsx');
  for (const field of ['author-name', 'review-text']) {
    assert(reviews.includes('htmlFor={`${formId}-' + field + '`}'));
    assert(reviews.includes('id={`${formId}-' + field + '`}'));
  }
  const promo = read('src/components/PromoCodeField.tsx');
  assert(promo.includes('<p role="alert" className="mt-2 text-xs font-medium text-[var(--qp-danger)]">{error}</p>'));
});
console.log(`${passed} Quiet Precision foundation groups passed`);
