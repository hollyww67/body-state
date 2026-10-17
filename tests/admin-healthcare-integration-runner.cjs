// Linux QA namespace only. Preserve the legacy suite's loopback port guards
// without reusing an unrelated host Redis already occupying port 16379.
const net = require('node:net');
const { spawn } = require('node:child_process');
if (process.env.STAGE3_ISOLATED !== 'true' || process.env.AUDIT_DATABASE_NAME !== 'audit_regression_2026101707') throw Error('Stage3 isolated namespace required');
const servers = [];
async function forward(port, host, targetPort) {
  const server = net.createServer(client => {
    const remote = net.connect(targetPort, host);
    client.on('error', () => remote.destroy()); remote.on('error', () => client.destroy());
    client.pipe(remote).pipe(client);
    client.on('close', () => remote.destroy());
  });
  servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
}
(async () => {
  await forward(15432, 'stage3-regression-pg', 5432);
  await forward(16379, 'stage3-regression-redis', 6379);
  const child = spawn(process.execPath, ['artifacts/audit-runtime/tests/audit-regressions.cjs'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'postgresql://postgres:hardening-local-only@127.0.0.1:15432/audit_regression_2026101707', REDIS_URL: 'redis://127.0.0.1:16379', POSTGRES_POOL_SIZE: '10' } });
  const code = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', resolve); });
  process.exitCode = code ?? 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => servers.forEach(server => server.close()));
