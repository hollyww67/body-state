// Re-run existing integration suites from TEMP against NEW databases only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawn } = require('node:child_process');
const { Pool } = require('pg');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
async function main() {
  const c = JSON.parse(execFileSync('docker', ['--context', 'default', 'inspect', 'body-state-notifications-qa-pg'], { encoding: 'utf8' }))[0];
  assert.equal(c.Config.Labels.purpose, 'notifications-isolated-qa');
  const binding = c.NetworkSettings.Ports['5432/tcp'][0];
  assert.equal(binding.HostIp, '127.0.0.1'); assert.ok(['15432', '15435'].includes(binding.HostPort));
  const redis = JSON.parse(execFileSync('docker', ['--context', 'default', 'inspect', 'body-state-notifications-qa-redis'], { encoding: 'utf8' }))[0];
  assert.equal(redis.Config.Labels.purpose, 'notifications-isolated-qa');
  assert.equal(redis.NetworkSettings.Ports['6379/tcp'][0].HostIp, '127.0.0.1');
  assert.equal(redis.NetworkSettings.Ports['6379/tcp'][0].HostPort, '16379');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-regression-qa-'));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'junction');
  function compile(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) compile(file);
      else if (/\.tsx?$/.test(file) && !file.endsWith('.d.ts')) {
        const target = path.join(output, path.relative(root, file).replace(/\.tsx?$/, '.js'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
          module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
        } }).outputText);
      }
    }
  }
  compile(path.join(root, 'src'));
  for (const dir of ['tests', 'scripts']) fs.mkdirSync(path.join(output, dir));
  fs.copyFileSync(path.join(root, 'scripts/migrate.mjs'), path.join(output, 'scripts/migrate.mjs'));
  fs.cpSync(path.join(root, 'migrations'), path.join(output, 'migrations'), { recursive: true });
  const connection = { host: '127.0.0.1', port: Number(binding.HostPort), user: 'notifications_qa', password: 'synthetic_notifications_qa', database: 'notifications_qa' };
  const admin = new Pool(connection);
  let failed = false;
  try {
    for (const [index, suite] of ['audit-regressions.cjs', 'scheduling-pool.cjs', 'scheduling-v2.cjs'].entries()) {
      const database = `audit_regression_${Date.now() + index}`;
      await admin.query(`CREATE DATABASE ${database}`);
      // Only change the port guard in the disposable copy; source suites stay untouched.
      const source = fs.readFileSync(path.join(root, 'tests', suite), 'utf8').replaceAll("'15432'", `'${binding.HostPort}'`);
      fs.writeFileSync(path.join(output, 'tests', suite), source);
      const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key))), DATABASE_URL: `postgresql://notifications_qa:synthetic_notifications_qa@127.0.0.1:${binding.HostPort}/${database}`,
        AUDIT_DATABASE_NAME: database, POSTGRES_POOL_SIZE: '10', POSTGRES_SSL: 'false',
        REDIS_URL: 'redis://127.0.0.1:16379', ADMIN_SESSION_SECRET: 'synthetic-qa-session-secret-32-characters',
        NOTIFICATIONS_EMAIL_V1_ENABLED: 'false', NOTIFICATIONS_MAX_V1_ENABLED: 'false' };
      console.log('RUN', suite, database, 'TEMP', output);
      const status = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(output, 'tests', suite)], { cwd: output, env, stdio: 'inherit' });
        child.on('error', reject); child.on('exit', resolve);
      });
      console.log('EXIT', suite, status); if (status !== 0) failed = true;
    }
  } finally { await admin.end(); }
  if (failed) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
