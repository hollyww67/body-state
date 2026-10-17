// Independent offline Stage 3 guards. No application execution, network or DB.
// Run: node tests/admin-healthcare-v3.cjs
// Fixed agreed base; do not substitute HEAD or silently accept new presentation logic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const base = 'd1c276602306ee8c6ab174c6269155fb08f435c0';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const list = value => value.split('\0').filter(Boolean);
const normalize = value => value.replace(/\r\n/g, '\n');
const baseline = file => git('show', `${base}:${file}`);
const allowed = new Set([
  'src/app/admin/design-system.css', 'src/app/admin/admin.css', 'src/app/admin/phase2.css',
  'src/app/admin/AdminSidebar.tsx', 'src/app/admin/AdminTopbar.tsx',
  'src/app/admin/bookings/page.tsx', 'src/app/admin/dashboard/page.tsx',
  'src/app/admin/calendar/page.tsx', 'src/components/admin/AdminToday.tsx',
  'src/components/admin/ScheduleTimeline.tsx',
  'src/app/admin/layout.tsx',
  'src/app/admin/healthcare-shell.css', 'src/app/admin/healthcare-dashboard.css', 'src/app/admin/healthcare-calendar.css',
  'src/components/admin/HealthcareMiniCalendar.tsx',
]);
const newFiles = new Set(['src/components/admin/HealthcareMiniCalendar.tsx',
  'src/app/admin/healthcare-shell.css', 'src/app/admin/healthcare-dashboard.css', 'src/app/admin/healthcare-calendar.css']);
const sourceFiles = [...allowed].filter(file => /\.tsx$/.test(file) && !newFiles.has(file));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Reviewed on 2026-10-17. Each hash pins the EXACT removed/added AST multiset, not
// a file-wide exemption. Any further change to a baseline entry creates a new delta.
// Requests and scheduling computations below never use these presentation approvals.
const reviewedDeltas = {
  'src/app/admin/AdminSidebar.tsx': {
    // Exact search event subscription/cleanup + two mobile labels; profile link and aria label.
    logic: '100f60d5e44a792aee133f6df5421ad27ad2114e548a12e3a946a202ee4b5893',
    attributes: '7623b11902b05f5e47dc25237d1a357f7da11dcc374e17c40478d5b98a2fbab5',
    expressions: '07d4806aea0adc9d61bc97ed46c336a4950e1cca387c852c9bc2f6bedb370d5b',
  },
  'src/app/admin/AdminTopbar.tsx': {
    // Exact UserRound import + native details user/help menu; second search has
    // the SAME event dispatch. Logout body/control checked independently below.
    logic: 'e2c58030e2409c563f22aeb8d1f10d0298f1c96b414a3369874884cac71f0de8',
    attributes: '413be04f5eaee09d29c47310eb8988d9a45ce275b4719c40e97e2c7f0d41ae2a',
    expressions: '2afa80c961bfcf20a8fcb889465d2f5c52749378886e20f983bbce594e9e66f7',
    submits: '200569463f1d4b2d91da154c3332db57f5a5ab2a16a5716c198a7b497e4e4325',
    handlers: 'e426a3523a3be5ffaa5e46fcecbc2ca2fb85b0fb5a7bfc592b860b9df9561143',
  },
  'src/app/admin/dashboard/page.tsx': {
    // Single MiniCalendar import; remove duplicate recent bookings, move revenue output;
    // exact first KPI label change only. All stats/hrefs protected independently below.
    logic: '7e91a68e47d638b9634e864ebcd86ab3a90fc247a6aa034dbb7f9f025121802a',
    attributes: 'fbf6c082d26b79cc55945691e66b7381796d375822e84e84be8e25b93432842a',
    expressions: 'b78d430a94d170a70dca12552e040f76e3023d7b87d4fa8a25147648ae8ce134',
  },
  'src/app/admin/calendar/page.tsx': {
    // Exact service select/direction counters/date strip/new-booking shortcut/data-service.
    // Mobile daily timeline duplicates exact existing props/callbacks; only days differs.
    // Initial month restored: NO logic exception is needed or allowed.
    attributes: 'b32a77e4e516b7fba4fb70b776788bab1fbcfe0099b8816dbbd9e07b27aebc03',
    expressions: '4c626a60c65cdad1a17d71881b0689056a6199d45c78b850f6380779f69aaa83',
    submits: '69eca10ecab83d29b2632a4c2df357b77cc629c40236ffd55e6ee3b197dbc093',
    handlers: 'a18f27c2cf3cae8f509a4609df31f4cc4d56c180e00ccbc6cc1813a5dd028aff',
  },
  'src/components/admin/AdminToday.tsx': {
    // Exact serviceLabel/appointmentTime output helpers, duplicated read-only agenda,
    // task disclosure/count, composite keys, native -> DS controls (same handlers),
    // calendarDayLabel with invalid-date fallback (isolated cases below).
    logic: 'bffadf407215dd3709a2c33d37ec47f47d3bc23c1ff4187971e5f20ca6621ea3',
    // Restore baseline selected-day title; no future-only filtering is introduced.
    attributes: '287f9757c0a3b3fbfc99b8e1a024f84ea59b50b01b681dd5fee6e8cf7afb137e',
    expressions: '887cc0d84cf867b88dbadc662d0cde4aa83ef48fb1d696af16d3067958739ec6',
    submits: '05b234d644736dc948ae1ed6015c193817f37dbd6e14405a456c7c3a861105fa',
  },
  'src/components/admin/ScheduleTimeline.tsx': {
    // Status badge import, data-service, end-time display using the EXISTING z.
    logic: 'cbb58949185717e096b2ba08538b5c5f947b7c1237ec362093494512ca1d24f0',
    attributes: '9631151feb9435c3a18a28f76ce734d8d12804db32aa5e56c070266a04f28a82',
    expressions: '1a9d792d2eca782f35e300830304322e9c979648b94e0af84626a89b44d8aae8',
  },
  'src/app/admin/layout.tsx': {
    // Exactly three local healthcare CSS imports; auth body remains baseline-exact.
    logic: 'afcf963ed2d1e708ad5d099be2e51415bb5dc6007427ef0169206a7320631475',
  },
};
function delta(before, after) {
  const remaining = [...before], added = [];
  for (const entry of after) {
    const index = remaining.indexOf(entry);
    if (index < 0) added.push(entry); else remaining.splice(index, 1);
  }
  return { removed: remaining.sort(), added: added.sort() };
}
function comparePresentation(file, key, before, after) {
  const changes = delta(before, after);
  if (!changes.removed.length && !changes.added.length) return;
  assert.equal(digest(changes), reviewedDeltas[file]?.[key], `${file} ${key}: unreviewed AST delta (${changes.removed.length} removed/${changes.added.length} added)`);
}
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`VERIFIED ${name}`); }
  catch (error) { failed++; console.error(`BLOCKED ${name}: ${error.message.slice(0, 1800)}`); }
}
function parse(file, text) {
  const source = ts.createSourceFile(file, normalize(text), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `${file}: invalid TS/TSX`);
  return source;
}
function walk(node, visit) { visit(node); ts.forEachChild(node, child => walk(child, visit)); }
const isJsx = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
function shape(node) {
  if (ts.isParenthesizedExpression(node)) return shape(node.expression);
  const children = [];
  ts.forEachChild(node, child => { children.push(shape(child)); });
  return [ts.SyntaxKind[node.kind], ...(typeof node.text === 'string' ? [node.text] : []),
    ...(typeof node.operator === 'number' ? [ts.SyntaxKind[node.operator]] : []), ...children];
}
function canonical(node, erase = false) {
  const result = ts.transform(node, [context => {
    const visit = n => erase && isJsx(n) ? ts.factory.createIdentifier('__VIEW__') : ts.visitEachChild(n, visit, context);
    return visit;
  }]);
  try { return JSON.stringify(shape(result.transformed[0])); } finally { result.dispose(); }
}
function contracts(source) {
  const attributes = [], requests = [], expressions = [], submits = [], handlers = [], styles = [];
  walk(source, node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const attrs = node.attributes.properties;
      for (const attr of attrs) if (ts.isJsxAttribute(attr)) {
        if (/^on[A-Z]/.test(attr.name.getText(source))) handlers.push(canonical(attr));
        if (attr.name.getText(source) === 'style') styles.push(canonical(attr));
      }
      // Keep complete attribute bundles: moving handlers/disabled state to another control must fail.
      const semantic = attrs.filter(a => !ts.isJsxAttribute(a) || !['className', 'style'].includes(a.name.getText(source)));
      if (semantic.length) attributes.push(JSON.stringify([tag, semantic.map(a => canonical(a))]));
      if (['button', 'AdminButton'].includes(tag)) {
        const type = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'type');
        submits.push(JSON.stringify([tag, type ? canonical(type) : tag === 'button' ? 'submit' : 'button']));
      }
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) expressions.push(canonical(node.expression, true));
    if (ts.isCallExpression(node) && /(?:fetch|request|post|put|patch|delete|stringify)$/.test(node.expression.getText(source))) requests.push(canonical(node));
  });
  return Object.fromEntries(Object.entries({ attributes, requests, expressions, submits, handlers, styles }).map(([key, values]) => [key, values.sort()]));
}
function logic(source) {
  // Only JSX itself is erased. Imports, hooks, validation, helpers, scheduling
  // arithmetic, constants and request payloads retain exact AST contracts.
  return source.statements.map(n => canonical(n, true));
}
function dashboardCards(node) {
  // Only this exact first-card string is normalized. Never erase cards, label
  // properties in general, value/detail/href expressions, or stats computations.
  assert(ts.isArrayLiteralExpression(node.initializer));
  assert.equal(node.initializer.elements.length, 4);
  const first = node.initializer.elements[0];
  assert(ts.isObjectLiteralExpression(first));
  const label = first.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText() === 'label');
  assert(label && ts.isStringLiteral(label.initializer));
  assert(['Ожидающие записи и обращения', 'Ожидают действий'].includes(label.initializer.text));
  const transformed = ts.transform(node, [context => {
    const visit = n => n === label.initializer ? ts.factory.createStringLiteral('Ожидающие записи и обращения') : ts.visitEachChild(n, visit, context);
    return visit;
  }]);
  try { return canonical(transformed.transformed[0]); } finally { transformed.dispose(); }
}
const expressionShape = text => canonical(parse('contract.tsx', `const value = (${text});`).statements[0].declarationList.declarations[0].initializer);
function checkMobileTimeline(source, before) {
  const timelines = [], wrappers = [];
  const classOf = node => node.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a)
    && a.name.getText(source) === 'className')?.initializer?.text;
  walk(source, node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'ScheduleTimeline') timelines.push(node);
    if (ts.isJsxElement(node) && classOf(node) === 'healthcare-mobile-timeline') wrappers.push(node);
  });
  assert.equal(wrappers.length, 1);
  assert.equal(timelines.length, 2, 'Exactly one extra local daily timeline');
  const wrapper = wrappers[0], mobile = [];
  walk(wrapper, node => { if (timelines.includes(node)) mobile.push(node); });
  assert.equal(mobile.length, 1);
  assert(ts.isBinaryExpression(wrapper.parent));
  assert.equal(wrapper.parent.operatorToken.kind, ts.SyntaxKind.AmpersandAmpersandToken);
  assert.equal(canonical(wrapper.parent.left), expressionShape("view !== 'month'"));
  const loading = wrapper.children.filter(ts.isJsxExpression).find(n => n.expression && ts.isConditionalExpression(n.expression))?.expression;
  assert(loading && loading.condition.getText(source) === 'loading', 'Mobile timeline retains loading guard');
  const original = [];
  walk(before, node => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(before) === 'ScheduleTimeline') original.push(node); });
  assert.equal(original.length, 1);
  const props = node => node.attributes.properties.map(a => canonical(a)).sort();
  const withoutDays = (node, sf) => node.attributes.properties.filter(a => !ts.isJsxAttribute(a)
    || a.name.getText(sf) !== 'days').map(a => canonical(a)).sort();
  assert.deepEqual(props(timelines.find(n => n !== mobile[0])), props(original[0]), 'Desktop timeline props stay base-exact');
  assert.deepEqual(withoutDays(mobile[0], source), withoutDays(original[0], before), 'Mobile filters, bookings, breaks, rules and callbacks stay base-exact');
  const days = mobile[0].attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'days');
  assert(days?.initializer && ts.isJsxExpression(days.initializer));
  assert.equal(canonical(days.initializer.expression), expressionShape('[selectedDay]'));
}
git('rev-parse', '--verify', `${base}^{commit}`);
const changed = list(git('diff', '--name-only', '-z', base));
const additions = list(git('ls-files', '--others', '--exclude-standard', '-z'));
if (process.argv.includes('--review-deltas')) {
  // Diagnostic only: print candidates for HUMAN review, never persist or auto-approve.
  for (const file of sourceFiles) {
    const before = parse(file, baseline(file)), after = parse(file, read(file));
    const pairs = { logic: [logic(before), logic(after)] };
    for (const key of Object.keys(contracts(before))) pairs[key] = [contracts(before)[key], contracts(after)[key]];
    const result = {};
    for (const [key, [a, b]] of Object.entries(pairs)) {
      const changes = delta(a, b);
      if (changes.removed.length || changes.added.length) result[key] = digest(changes);
    }
    console.log(JSON.stringify({ file, result }));
  }
  const mini = 'src/components/admin/HealthcareMiniCalendar.tsx';
  console.log(JSON.stringify({ mini: digest(canonical(parse(mini, read(mini)))) }));
  process.exit(0);
}
test('fixed base, branch and scoped runtime boundary', () => {
  assert.equal(git('branch', '--show-current').trim(), 'feat/admin-premium-healthcare-v3');
  assert.deepEqual(changed.filter(file => !allowed.has(file) && !file.startsWith('tests/') && !/^(docs\/|[^/]+\.md$)/.test(file)), []);
  assert.deepEqual(additions.filter(file => !allowed.has(file) && !file.startsWith('tests/') && !/^(docs\/|[^/]+\.md$)/.test(file)), [], 'Untracked runtime/config requires review');
});
test('tracked backend/API/lib/auth/migrations/deps/public/configs retain base repository content', () => {
  // Git compares against the fixed base with repository EOL normalization. This checks
  // repository content, not literal on-disk CRLF bytes; no protected path exemption.
  for (const file of changed.filter(file => !allowed.has(file) && !file.startsWith('tests/') && !/^(docs\/|[^/]+\.md$)/.test(file))) {
    assert.fail(`Outside Stage 3 scope: ${file}`);
  }
});
test('AA semantic text contrast in default and optional violet token themes', () => {
  const css = require('postcss').parse(read('src/app/admin/design-system.css'));
  const themes = new Map();
  css.walkRules(rule => {
    const tokens = {};
    for (const node of rule.nodes) if (node.type === 'decl' && node.prop.startsWith('--bs-')) tokens[node.prop] = node.value;
    if (Object.keys(tokens).length) themes.set(rule.selector, tokens);
  });
  const defaults = [...themes.values()].find(tokens => tokens['--bs-background'] && tokens['--bs-on-primary']);
  assert(defaults, 'Default palette missing');
  function luminance(value) {
    assert(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value || ''), `Unsupported color requires explicit contrast review: ${value}`);
    const hex = value.length === 4 ? [...value.slice(1)].map(c => c + c).join('') : value.slice(1);
    const rgb = hex.match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  }
  for (const [selector, overrides] of themes) {
    if (!overrides['--bs-background']) continue;
    const palette = { ...defaults, ...overrides };
    for (const [fg, bg] of [['foreground', 'background'], ['foreground', 'surface'], ['muted', 'surface'], ['muted', 'background'],
      ['on-primary', 'primary'], ['on-primary', 'primary-hover'], ['success', 'success-bg'], ['warning', 'warning-bg'],
      ['destructive', 'destructive-bg'], ['info', 'info-bg']]) {
      const a = luminance(palette[`--bs-${fg}`]), b = luminance(palette[`--bs-${bg}`]);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      assert(ratio >= 4.5, `${selector}: ${fg}/${bg} ${ratio.toFixed(2)} < 4.5`);
    }
  }
});
test('AA small agenda text on the actual healthcare event background tokens', () => {
  const sheet = postcss.parse(read('src/app/admin/design-system.css'));
  const tokens = {};
  sheet.nodes.find(n => n.type === 'rule').walkDecls(decl => { tokens[decl.prop] = decl.value; });
  const lum = value => {
    assert(/^#[\da-f]{6}$/i.test(value), `Review color ${value}`);
    return value.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
      .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
      .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  };
  const css = postcss.parse(read('src/app/admin/healthcare-dashboard.css'));
  const colors = [], backgrounds = [];
  css.walkRules(rule => {
    if (['.healthcare-dashboard .healthcare-agenda-event time', '.healthcare-dashboard .healthcare-agenda-event small'].includes(rule.selector)) rule.walkDecls('color', d => colors.push(d.value));
    if (/^\.healthcare-dashboard \.healthcare-agenda-event(?:\.|$)/.test(rule.selector)) rule.walkDecls('background', d => backgrounds.push(d.value));
  });
  assert(colors.length && backgrounds.length, 'Agenda CSS changed: review actual pairs');
  const resolve = value => tokens[value.match(/^var\((--bs-[\w-]+)\)$/)?.[1]] || value;
  for (const fg of colors) for (const bg of backgrounds) {
    const a = lum(resolve(fg)), b = lum(resolve(bg));
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    assert(ratio >= 4.5, `${fg}/${bg}: ${ratio.toFixed(3)} < 4.5 (small agenda text)`);
  }
});
for (const file of sourceFiles) {
  test(`non-JSX logic/imports: ${file}`, () => comparePresentation(file, 'logic', logic(parse(file, baseline(file))), logic(parse(file, read(file)))));
  for (const key of ['attributes', 'requests', 'expressions', 'submits', 'handlers', 'styles']) test(`${key}: ${file}`, () => {
    const before = contracts(parse(file, baseline(file)))[key], after = contracts(parse(file, read(file)))[key];
    if (['requests', 'styles'].includes(key)) assert.deepEqual(after, before);
    else comparePresentation(file, key, before, after);
  });
}
for (const file of ['src/components/admin/ScheduleTimeline.tsx', 'src/app/admin/calendar/page.tsx',
  'src/app/admin/bookings/page.tsx', 'src/app/admin/dashboard/page.tsx', 'src/components/admin/AdminToday.tsx']) {
test(`exact existing computations/validation/hooks: ${file}`, () => {
  // Walk INSIDE JSX callbacks: erasing a return tree alone would miss timeline a/z,
  // conflict/box/column calculations. Additions are pinned by presentation deltas above.
    const declarations = source => {
      const found = [];
      walk(source, node => {
        if (ts.isVariableDeclaration(node)) {
          let containsJsx = false;
          if (node.initializer) walk(node.initializer, child => { if (isJsx(child)) containsJsx = true; });
          if (!containsJsx) found.push(file === 'src/app/admin/dashboard/page.tsx' && node.name.getText(source) === 'cards'
            ? dashboardCards(node) : canonical(node));
        }
      });
      return found;
    };
    const difference = delta(declarations(parse(file, read(file))), declarations(parse(file, baseline(file))));
    assert.deepEqual(difference.added, [], `${file}: baseline computation removed/changed`);
});
}
test('MiniCalendar is exactly the reviewed local date reference, without API integration', () => {
  const file = 'src/components/admin/HealthcareMiniCalendar.tsx';
  assert.equal(digest(canonical(parse(file, read(file)))), '44eb14aa9286b3c887e6086fae9527ef653336f6632d326f46bf0aa6afaeaaa5');
});
test('new healthcare CSS is namespaced, with no global imports/tokens/animations', () => {
  for (const file of [...newFiles].filter(file => file.endsWith('.css'))) {
    const css = postcss.parse(read(file));
    css.walkAtRules(rule => assert.equal(rule.name, 'media', `${file}: @${rule.name} requires review`));
    css.walkRules(rule => {
      for (const selector of postcss.list.comma(rule.selector)) {
        assert(/^\.(?:admin-|bs-|healthcare-)[\w-]+(?:[\s.#:[>+~]|$)/.test(selector.trim()), `${file}: global selector ${selector}`);
      }
    });
    css.walkDecls(decl => {
      assert(!decl.prop.startsWith('--'), `${file}: token override ${decl.prop}`);
      assert(!/url\s*\(|@import/i.test(decl.value), `${file}: external CSS resource`);
    });
  }
});
test('new stylesheets are imported only by the admin layout', () => {
  const imports = [];
  function scan(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) scan(file);
      else if (/\.(?:tsx?|jsx?|css)$/.test(file) && /(?:import\s*[^;]*|@import\s*)['"][^'"]*healthcare-(?:shell|dashboard|calendar)\.css['"]/.test(read(file))) imports.push(file);
    }
  }
  scan('src');
  assert.deepEqual(imports, ['src/app/admin/layout.tsx']);
});
test('mobile daily timeline preserves existing filters/data/callbacks and desktop props', () => {
  const file = 'src/app/admin/calendar/page.tsx';
  const source = read(file), before = parse(file, baseline(file));
  checkMobileTimeline(parse(file, source), before);
  // Mutate only the new node: no file changes and no application execution.
  const start = source.indexOf('className="healthcare-mobile-timeline"'), end = source.indexOf('className="healthcare-calendar-desktop-grid"', start);
  assert(start >= 0 && end > start);
  const mutate = (from, to) => {
    const chunk = source.slice(start, end);
    assert(chunk.includes(from));
    return parse(file, source.slice(0, start) + chunk.replace(from, to) + source.slice(end));
  };
  for (const [from, to] of [['days={[selectedDay]}', 'days={[rangeStart]}'], ['onSlot={setSlotDetails}', 'onSlot={setBreakDetails}'],
    ["selectedType==='all'||s.service_type===selectedType", 'false'], ['breaks={scheduleBreaks}', 'breaks={[]}']]) {
    assert.throws(() => checkMobileTimeline(mutate(from, to), before));
  }
});
test('responsive CSS keeps mobile monthly grid and switches non-month views to daily timeline', () => {
  const css = postcss.parse(read('src/app/admin/healthcare-calendar.css'));
  let hiddenByDefault = 0, shownOnMobile = 0, conditionalDesktopHide = 0;
  css.walkRules(rule => {
    rule.walkDecls('display', decl => {
      const media = rule.parent.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null;
      if (rule.selector === '.healthcare-mobile-timeline') {
        if (decl.value === 'none' && media === null) hiddenByDefault++;
        else if (decl.value === 'block' && media === '(max-width: 640px)') shownOnMobile++;
        else assert.fail('Unreviewed mobile timeline visibility');
      }
      if (rule.selector.includes('.healthcare-calendar-desktop-grid') && decl.value === 'none') {
        assert.equal(rule.selector, '.admin-calendar-layout:not([data-view="month"]) .healthcare-calendar-desktop-grid');
        assert.equal(media, '(max-width: 640px)');
        conditionalDesktopHide++;
      }
    });
  });
  assert.equal(hiddenByDefault, 1);
  assert.equal(shownOnMobile, 1);
  assert.equal(conditionalDesktopHide, 1);
});
test('presentation time helper handles Moscow midnight, missing and invalid timestamps', () => {
  const file = 'src/components/admin/AdminToday.tsx', source = parse(file, read(file));
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'appointmentTime');
  assert(fn);
  const code = ts.transpileModule(`${fn.getText(source)}; exports.time = appointmentTime;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {} };
  require('node:vm').runInNewContext(code, context, { timeout: 1000 });
  assert.equal(context.exports.time(undefined), '—');
  assert.equal(context.exports.time('invalid'), '—');
  assert.equal(context.exports.time('2026-10-16T21:30:00Z'), '00:30');
});
test('mobile topbar search has a name when its text span is display:none', () => {
  const file = 'src/app/admin/AdminTopbar.tsx', source = parse(file, read(file));
  let found = false;
  walk(source, node => {
    if (!ts.isJsxOpeningElement(node) || node.tagName.getText(source) !== 'button') return;
    const attrs = node.attributes.properties;
    if (!attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'className' && a.initializer?.text === 'healthcare-section-search')) return;
    found = true;
    assert(attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'aria-label'
      && a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === 'Найти раздел или действие'), 'At <=640px the label span is hidden; preserve the reviewed accessible name');
  });
  assert(found);
});
test('Topbar native user menu retains logout contract, safe public link and both search dispatches', () => {
  const file = 'src/app/admin/AdminTopbar.tsx', source = parse(file, read(file)), before = parse(file, baseline(file));
  const elements = [];
  walk(source, node => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); });
  const opening = node => ts.isJsxElement(node) ? node.openingElement : node;
  const attr = (node, name) => opening(node).attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === name);
  const classIs = (node, name) => attr(node, 'className')?.initializer?.text === name;
  const menu = elements.filter(node => classIs(node, 'healthcare-user-menu'));
  assert.equal(menu.length, 1);
  assert.equal(opening(menu[0]).tagName.getText(source), 'details');
  assert(!attr(menu[0], 'open') && !attr(menu[0], 'role'), 'Keep native, initially closed disclosure semantics');
  assert.equal(canonical(attr(menu[0], 'key').initializer.expression), expressionShape('pathname'));
  const directChildren = menu[0].children.filter(n => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n));
  assert.equal(opening(directChildren[0]).tagName.getText(source), 'summary');
  assert.equal(attr(directChildren[0], 'aria-label')?.initializer?.text, 'Меню администратора');
  const inside = new Set(); walk(menu[0], node => inside.add(node));
  for (const tag of ['AdminThemeToggle']) assert.equal(elements.filter(n => inside.has(n) && opening(n).tagName.getText(source) === tag).length, 1);
  const help = elements.filter(n => (attr(n, 'className')?.initializer?.text || '').split(/\s+/).includes('healthcare-help'));
  assert.equal(help.length, 1);
  assert(inside.has(help[0]) && opening(help[0]).tagName.getText(source) === 'details');
  const helpSummary = help[0].children.find(ts.isJsxElement);
  assert.equal(opening(helpSummary).tagName.getText(source), 'summary');
  assert(helpSummary.children.some(n => ts.isJsxText(n) && n.text.includes('Помощь по разделу')));
  const searches = elements.filter(n => classIs(n, 'healthcare-section-search') || classIs(n, 'healthcare-tools-search'));
  assert.equal(searches.length, 2);
  const dispatch = expressionShape('() => window.dispatchEvent(new Event("admin-navigation-search"))');
  for (const search of searches) {
    assert.equal(opening(search).tagName.getText(source), 'button');
    assert.equal(attr(search, 'type')?.initializer?.text, 'button');
    assert.equal(canonical(attr(search, 'onClick').initializer.expression), dispatch);
  }
  const dropdownSearch = searches.find(n => classIs(n, 'healthcare-tools-search'));
  assert(inside.has(dropdownSearch));
  assert(dropdownSearch.children.some(n => ts.isJsxText(n) && n.text.includes('Найти раздел')));
  const logout = elements.filter(n => attr(n, 'onClick')?.initializer?.expression?.getText(source) === 'logout');
  assert.equal(logout.length, 1);
  assert(inside.has(logout[0]));
  assert.equal(attr(logout[0], 'type')?.initializer?.text, 'button');
  assert.equal(attr(logout[0], 'disabled')?.initializer?.expression?.getText(source), 'loggingOut');
  const findLogout = sf => {
    const found = [];
    walk(sf, node => {
      if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(sf) === 'logout') found.push(canonical(node));
    });
    assert.equal(found.length, 1); return found;
  };
  assert.deepEqual(findLogout(source), findLogout(before), 'Logout body stays exactly baseline, no presentation exemption');
  const publicLinks = elements.filter(n => opening(n).tagName.getText(source) === 'Link' && attr(n, 'target')?.initializer?.text === '_blank');
  assert.equal(publicLinks.length, 1);
  assert(inside.has(publicLinks[0]));
  for (const [name, value] of Object.entries({ href: '/', rel: 'noopener noreferrer', 'aria-label': 'Открыть сайт в новой вкладке' })) assert.equal(attr(publicLinks[0], name)?.initializer?.text, value);
});
test('BookingHistory retains exact props and is the last DOM item without CSS order', () => {
  const file = 'src/app/admin/bookings/page.tsx', source = parse(file, read(file)), before = parse(file, baseline(file));
  const histories = sf => {
    const found = [];
    walk(sf, n => { if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'BookingHistory') found.push(n); });
    assert.equal(found.length, 1); return found[0];
  };
  const current = histories(source);
  assert.equal(canonical(current), canonical(histories(before)), 'key/id/revision unchanged');
  const container = current.parent;
  assert(ts.isJsxElement(container));
  assert(container.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'className'
    && a.initializer?.text?.split(/\s+/).includes('healthcare-booking-details')));
  const children = container.children.filter(n => !ts.isJsxText(n) || n.text.trim());
  assert.equal(children.at(-1), current, 'History must be last in DOM, not visually reordered');
  for (const file of ['src/app/admin/admin.css', 'src/app/admin/design-system.css', 'src/app/admin/phase2.css', ...newFiles].filter(f => f.endsWith('.css'))) {
    postcss.parse(read(file)).walkRules(rule => {
      if (/booking-details|booking-modal/.test(rule.selector)) rule.walkDecls(decl => {
        assert(!['order', 'grid-row', 'grid-row-start', 'grid-area'].includes(decl.prop), `${file}: CSS history reordering`);
      });
    });
  }
});
test('mobile Topbar utilities use fixed brand row while dropdown search remains present', () => {
  const css = postcss.parse(read('src/app/admin/healthcare-shell.css'));
  const rules = [];
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'media' && rule.parent.params === '(max-width: 1023px)') rules.push(rule);
  });
  const declarations = selector => Object.fromEntries(rules.filter(r => r.selector === selector).flatMap(r => r.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])));
  const topbar = declarations('.admin-topbar');
  for (const [name, value] of Object.entries({ position: 'fixed', top: 'env(safe-area-inset-top)', right: '12px', 'min-height': '60px', background: 'transparent', border: '0' })) assert.equal(topbar[name], value, name);
  assert.equal(declarations('.healthcare-section-search').display, 'none');
  css.walkRules(rule => {
    // The decorative native disclosure marker may be hidden; the actual controls may not.
    if (rule.selector === '.healthcare-user-menu > summary::-webkit-details-marker') return;
    if (/healthcare-tools-search|healthcare-user-menu|healthcare-user-popover/.test(rule.selector)) rule.walkDecls('display', d => assert.notEqual(d.value, 'none', 'Do not hide the mobile fallback search/menu'));
  });
});
test('dashboard compact copy preserves all four cards/stats and exact quick action destinations', () => {
  const file = 'src/app/admin/dashboard/page.tsx', source = parse(file, read(file)), before = parse(file, baseline(file));
  const cards = sf => {
    let declaration;
    walk(sf, n => { if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'cards') declaration = n; });
    assert(declaration); return declaration;
  };
  assert.deepEqual(dashboardCards(cards(source)), dashboardCards(cards(before)));
  const links = [];
  walk(source, n => {
    if (!ts.isJsxElement(n) || n.openingElement.tagName.getText(source) !== 'Link') return;
    const attrs = n.openingElement.attributes.properties;
    if (!attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'className' && a.initializer?.text?.split(/\s+/).includes('admin-quick-action'))) return;
    const href = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'href')?.initializer?.text;
    const spans = n.children.filter(c => ts.isJsxElement(c) && c.openingElement.tagName.getText(source) === 'span');
    assert.equal(spans.length, 1);
    links.push([href, spans[0].children.filter(ts.isJsxText).map(c => c.text).join('').trim()]);
  });
  assert.deepEqual(links, [['/admin/bookings?create=1', 'Новая запись'], ['/admin/bookings', 'Найти клиента'], ['/admin/slots', 'Расписание'], ['/admin/payment-links', 'Ссылка на оплату']]);
  const changedStats = parse(file, read(file).replace('value: stats.pendingBookings', 'value: stats.reviews'));
  assert.notEqual(dashboardCards(cards(changedStats)), dashboardCards(cards(before)), 'Copy exception must not hide a changed KPI source');
});
test('mobile density CSS keeps its route/breakpoint scope and More navigation intact', () => {
  const cssFiles = ['src/app/admin/healthcare-dashboard.css', 'src/app/admin/healthcare-calendar.css'];
  const declaration = (file, selector, property, media) => {
    const matches = [];
    postcss.parse(read(file)).walkRules(rule => {
      if (!postcss.list.comma(rule.selector).includes(selector)) return;
      rule.walkDecls(property, decl => {
        // Exact reviewed route-local exceptions: calendar description/statistics
        // are hidden at all sizes. No other hiding receives a root-level exemption.
        if (file === cssFiles[1] && rule.parent.type === 'root' && property === 'display' && decl.value === 'none'
          && ['.healthcare-calendar-title p', '.admin-calendar-page .healthcare-calendar-stats'].includes(selector)) return;
        if (property === 'display' && decl.value === 'none') {
          assert.equal(rule.parent.name, 'media', selector);
          assert.equal(rule.parent.params, media, selector);
        }
        if (rule.parent.name !== 'media' || rule.parent.params !== media) return;
        matches.push(decl.value);
      });
    });
    assert.equal(matches.length, 1, selector);
    return matches[0];
  };
  assert.equal(declaration(cssFiles[0], '.healthcare-dashboard.admin-dashboard-v2 .admin-stat-grid', 'grid-template-columns', '(max-width: 639px)'), 'repeat(3, minmax(0, 1fr))');
  assert.equal(declaration(cssFiles[0], '.healthcare-dashboard .admin-stat-card:last-child', 'display', '(max-width: 639px)'), 'none');
  assert.equal(declaration(cssFiles[0], '.healthcare-dashboard .admin-dashboard-welcome', 'min-height', '(max-width: 639px)'), '0');
  assert.equal(declaration(cssFiles[0], '.healthcare-dashboard .admin-dashboard-actions .admin-quick-action', 'min-height', '(max-width: 639px)'), '88px');
  assert.equal(declaration(cssFiles[0], '.healthcare-dashboard .healthcare-day-toolbar label', 'font-size', '(max-width: 639px)'), '0');
  const mobile = [];
  postcss.parse(read(cssFiles[0])).walkRules(rule => {
    if (rule.selector === '.healthcare-dashboard .admin-dashboard-actions .admin-quick-action-list' && rule.parent.params === '(max-width: 639px)') rule.walkDecls('grid-template-columns', d => mobile.push(d.value));
  });
  assert.deepEqual(mobile, ['repeat(4, minmax(0, 1fr))']);
  const rootHidden = [];
  postcss.parse(read(cssFiles[1])).walkRules(rule => {
    if (rule.parent.type === 'root' && ['.healthcare-calendar-title p', '.admin-calendar-page .healthcare-calendar-stats'].includes(rule.selector)) {
      rule.walkDecls('display', d => { assert.equal(d.value, 'none'); rootHidden.push(rule.selector); });
    }
  });
  assert.deepEqual(rootHidden.sort(), ['.admin-calendar-page .healthcare-calendar-stats', '.healthcare-calendar-title p']);
  for (const selector of ['.admin-shell:has(.admin-calendar-page) .admin-mobile-bar', '.admin-shell:has(.admin-calendar-page) .admin-topbar',
    '.healthcare-mobile-timeline .bs-timeline-heading', '.healthcare-calendar-title p', '.admin-calendar-page .healthcare-calendar-stats']) {
    assert.equal(declaration(cssFiles[1], selector, 'display', '(max-width: 640px)'), 'none');
  }
  assert.equal(declaration(cssFiles[1], '.admin-shell:has(.admin-calendar-page) .admin-main', 'padding-top', '(max-width: 640px)'), '0');
  assert.equal(declaration(cssFiles[1], '.admin-calendar-layout[data-view="month"] .healthcare-calendar-date-strip', 'display', '(max-width: 640px)'), 'none');
  for (const file of cssFiles) postcss.parse(read(file)).walkRules(rule => {
    if (/admin-mobile-bottom|admin-navigation|admin-sidebar/.test(rule.selector)) rule.walkDecls('display', d => assert.notEqual(d.value, 'none', 'Keep More/sidebar reachable'));
  });
  const sidebar = parse('src/app/admin/AdminSidebar.tsx', read('src/app/admin/AdminSidebar.tsx'));
  const more = [];
  walk(sidebar, n => {
    if (ts.isJsxOpeningElement(n) && n.tagName.getText(sidebar) === 'button'
      && n.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(sidebar) === 'aria-label' && a.initializer?.text === 'Все разделы')) more.push(n);
  });
  assert.equal(more.length, 1);
  const onClick = more[0].attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(sidebar) === 'onClick');
  assert.equal(canonical(onClick.initializer.expression), expressionShape('() => { setCollapsed(false); setMobileOpen(true); }'));
});
test('AdminToday selected-day title and date accessibility survive compact presentation', () => {
  const file = 'src/components/admin/AdminToday.tsx', source = parse(file, read(file)), before = parse(file, baseline(file));
  const appointmentList = sf => {
    const matches = [];
    walk(sf, n => {
      if (!ts.isJsxElement(n) || n.openingElement.tagName.getText(sf) !== 'List') return;
      const rendersAppointments = n.children.some(c => ts.isJsxExpression(c) && ts.isCallExpression(c.expression)
        && c.expression.expression.getText(sf) === 'data.appointments.map');
      if (rendersAppointments) matches.push(n);
    });
    assert.equal(matches.length, 1); return matches[0];
  };
  const title = (node, sf) => node.openingElement.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'title');
  assert.equal(canonical(title(appointmentList(source), source)), canonical(title(appointmentList(before), before)));
  const inputs = [];
  walk(source, n => {
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(source) === 'AdminInput' && n.attributes.properties.some(a => ts.isJsxAttribute(a)
      && a.name.getText(source) === 'type' && a.initializer?.text === 'date')) inputs.push(n);
  });
  assert.equal(inputs.length, 1);
  assert(inputs[0].attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'aria-label' && a.initializer?.text === 'Дата рабочего дня'));
  assert(inputs[0].attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'value' && a.initializer?.expression?.getText(source) === 'day'));
  assert(ts.isJsxElement(inputs[0].parent) && inputs[0].parent.openingElement.tagName.getText(source) === 'label');
  assert(inputs[0].parent.children.some(n => ts.isJsxText(n) && n.text.includes('Дата по Москве')), 'Keep native label text in DOM despite font-size:0');
});
test('AdminToday selected-day presentation tolerates a cleared native date input', () => {
  const file = 'src/components/admin/AdminToday.tsx', source = parse(file, read(file));
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'calendarDayLabel');
  assert(fn, 'Reviewed date presentation helper required');
  let calls = 0;
  walk(source, node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'calendarDayLabel') {
      assert.equal(node.arguments.length, 1);
      assert.equal(node.arguments[0].getText(source), 'day');
      assert(ts.isJsxExpression(node.parent), 'Helper must be wired to the rendered date label');
      calls++;
    }
  });
  assert.equal(calls, 1);
  const code = ts.transpileModule(`${fn.getText(source)}; exports.renderDay = calendarDayLabel;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {} };
  require('node:vm').runInNewContext(code, context, { timeout: 1000 });
  assert.equal(context.exports.renderDay('2026-10-17'), '17 октября');
  assert.equal(context.exports.renderDay('2024-02-29'), '29 февраля');
  for (const day of ['', 'invalid', '2026-13-17']) {
    assert.equal(context.exports.renderDay(day), 'Выберите дату', `Invalid/cleared date: ${day}`);
  }
});
test('guard mutation checks, CRLF stability and control binding', () => {
  const p = text => parse('fixture.tsx', text);
  const a = 'function A(){const end=start+duration;return <button disabled={busy} onClick={()=>save(id)}>OK</button>}';
  assert.deepEqual(logic(p(a)), logic(p(a.replace(/;/g, ';\r\n'))));
  assert.notDeepEqual(logic(p(a)), logic(p(a.replace('start+duration', 'start-duration'))));
  for (const [before, after, key] of [
    ['<button onClick={()=>save(1)}/>', '<button onClick={()=>save(2)}/>', 'attributes'],
    ['fetch("/api/a",{body:JSON.stringify({id:1})})', 'fetch("/api/a",{body:JSON.stringify({id:2})})', 'requests'],
    ['<button/>', '<button type="button"/>', 'submits'],
    ['<input required disabled={busy}/>', '<input required disabled={false}/>', 'attributes'],
    ['<><input id="a" onChange={save}/><input id="b"/></>', '<><input id="a"/><input id="b" onChange={save}/></>', 'attributes'],
  ]) assert.notDeepEqual(contracts(p(before))[key], contracts(p(after))[key]);
  const file = 'src/components/admin/ScheduleTimeline.tsx';
  const source = read(file);
  const before = contracts(parse(file, baseline(file))).expressions;
  assert.throws(() => comparePresentation(file, 'expressions', before,
    contracts(parse(file, source.replace('new Date(z)', 'new Date(z+60000)'))).expressions));
  assert.throws(() => comparePresentation('src/app/admin/dashboard/page.tsx', 'logic', ['baseline'], ['mutated']));
});
test('existing native props, CSS scope, keyboard, motion and AA regressions', () => {
  // Existing VM contracts never execute application imports; process failure is propagated.
  const output = execFileSync(process.execPath, ['tests/admin-design-system.cjs'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert(output.includes('regression groups PASS'));
  console.log(output.trim());
});
const implementation = changed.filter(file => allowed.has(file));
console.log(`Stage 3: ${passed} VERIFIED, ${failed} BLOCKED offline groups. Base ${base}.`);
console.log(implementation.length ? `NOT TESTED final implementation acceptance: ${implementation.length} tracked presentation files changed; offline results only, review BLOCKED groups individually.`
  : 'NOT TESTED Stage 3 implementation: no presentation diff yet; baseline verification only.');
console.log('NOT TESTED browser/rendered contrast/focus/real runtime/authorization: main owns browser acceptance.');
process.exitCode = failed ? 1 : 0;
