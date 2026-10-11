// Synthetic login and a small scheduling fixture for local browser QA only.
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const url = new URL(process.env.DATABASE_URL || '');
if (url.hostname !== '127.0.0.1' || url.port !== '15432' || !/^\/audit_regression_\d+$/.test(url.pathname)) {
  throw new Error('Only an isolated local audit_regression database is allowed');
}
const pool = new Pool({ connectionString: url.toString() });
(async () => {
  await pool.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',
    ['admin_password_hash', bcrypt.hashSync('Hardening-QA-only-2026', 10)]);
  await pool.query("INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES('bfm','2101-03-08T09:30:00+03:00',90),('psychology','2101-03-09T09:30:00+03:00',90) ON CONFLICT DO NOTHING");
  console.log('Local QA fixture prepared. Synthetic login: hardening-qa / Hardening-QA-only-2026');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
