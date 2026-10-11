// CI never consumes .env.local or production credentials.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const env = require('./stage05-env.cjs')();
const url = new URL(env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '15432' || url.pathname !== '/audit_regression_2026101005') throw new Error('Unsafe database');
const checks = [
  ['isolated database', ['scripts/stage05-test-db.cjs']],
  ['typescript', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['eslint', ['node_modules/eslint/bin/eslint.js', 'src']],
  ['payment unit', ['tests/payment-init.cjs']],
  ['PWA unit', ['tests/admin-pwa.cjs']],
  ...(fs.existsSync('tests/admin-modal.cjs') ? [['modal unit', ['tests/admin-modal.cjs']]] : []),
  ['mock providers', ['tests/stage05-providers.cjs']],
  ['secret checks', ['scripts/stage05-secrets.cjs']],
  ['compile integration', ['scripts/build-audit-tests.cjs']],
  ['integration + test migrations', ['artifacts/audit-runtime/tests/audit-regressions.cjs']],
  ['build', ['node_modules/next/dist/bin/next', 'build']],
];
let failed = false;
env.AUDIT_DATABASE_NAME = `audit_regression_${Date.now()}`;
for (const [name, args] of checks) {
  console.log(`\nCHECK: ${name}`);
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
