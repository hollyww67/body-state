// Read-only drill against a named LOCAL restored copy, never production.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
process.env.DATABASE_URL = 'postgresql://doctor_qa:doctor_qa_local_only@127.0.0.1:15432/stage06_restore_20261011?options=-c%20default_transaction_read_only%3Don';
process.env.REDIS_URL = 'redis://127.0.0.1:16379';
process.env.POSTGRES_SSL = 'false';
const base = path.resolve(__dirname, '../artifacts/audit-runtime/src');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) { return resolve.call(this, id.startsWith('@/') ? path.join(base, id.slice(2)) : id, ...args); };
const { pool } = require(path.join(base, 'lib/db.js'));
const { getRedis } = require(path.join(base, 'lib/redis.js'));
(async () => {
  assert.equal((await pool.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows;
  assert.equal(tables.length, 34);
  let rows = 0;
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z_]+$/);
    rows += Number((await pool.query(`SELECT count(*) AS n FROM "${tablename}"`)).rows[0].n);
  }
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM schema_migrations')).rows[0].n), 20);
  const response = await require(path.join(base, 'app/api/health/route.js')).GET();
  assert.equal(response.status, 200);
  console.log(JSON.stringify({ restore: 'PASS', tables: tables.length, totalRows: rows, migrations: 20, applicationHealthHandler: await response.json(), readOnly: true }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await pool.end(); const redis = await getRedis(); if (redis) await redis.quit();
});
