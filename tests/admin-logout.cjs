const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextResponse } = require('next/server');

const source = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/logout/route.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const mutations = [];
const revoked = [];
let token;
const cookieStore = {
  get: () => token === undefined ? undefined : { value: token },
  set: (...args) => mutations.push(['set', ...args]),
  delete: name => mutations.push(['delete', name]),
};
const imports = {
  'next/server': { NextResponse },
  'next/headers': { cookies: async () => cookieStore },
  '@/lib/admin-auth': { ADMIN_COOKIE: 'admin_session', revokeAdminSessionToken: async value => revoked.push(value) },
};
const mod = { exports: {} };
new Function('require', 'module', 'exports', outputText)(id => {
  assert.ok(id in imports, `Unexpected import: ${id}`);
  return imports[id];
}, mod, mod.exports);

(async () => {
  for (const current of ['synthetic-session-only', undefined]) {
    token = current;
    mutations.length = 0;
    const response = await mod.exports.POST();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('location'), null, 'fetch must not follow internal-origin/POST redirects');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(revoked.at(-1), current);
    assert.equal(mutations[0][0], 'set');
    assert.equal(mutations[0][2], '');
    assert.equal(mutations[0][3].maxAge, 0);
    assert.equal(mutations[0][3].httpOnly, true);
    assert.equal(mutations[0][3].path, '/');
    assert.ok(mutations.some(([operation, name]) => operation === 'delete' && name === 'admin_session'));
    assert.ok(mutations.some(([operation, name]) => operation === 'delete' && name === 'admin_token'));
  }
  console.log('PASS authenticated/anonymous logout: session revocation, cookie expiry, no proxy redirect');
})().catch(error => { console.error(error); process.exitCode = 1; });
