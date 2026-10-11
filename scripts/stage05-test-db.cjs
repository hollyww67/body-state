const { Client } = require('pg');
const url = new URL(process.env.DATABASE_URL);
const name = process.env.AUDIT_DATABASE_NAME;
if (url.hostname !== '127.0.0.1' || url.port !== '15432' || !/^audit_regression_\d+$/.test(name || '') || !/^\/audit_regression_\d+$/.test(url.pathname)) throw new Error('Unsafe test DB target');
const client = new Client({ connectionString: url.toString() });
(async () => {
  await client.connect();
  // Strict allowlist above; no user-controlled SQL identifiers are accepted.
  await client.query(`CREATE DATABASE "${name}"`);
  console.log('Created disposable integration database:', name);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => client.end());
