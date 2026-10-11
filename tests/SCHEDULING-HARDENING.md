# Scheduling Hardening V1 — isolated QA

No real credentials, bank requests, SMTP/SMS/push traffic or production database access.
The integration runner rejects database names outside `audit_regression_<digits>` and
requires local PostgreSQL port15432. Real session tests require local Redis port16379.
The containers below must be NEW task-owned instances, not your normal development databases.

```powershell
docker run --name body-state-hardening-pg-20261011 --label body-state.task=scheduling-hardening-v1 -e POSTGRES_PASSWORD=hardening-local-only -e POSTGRES_DB=audit_regression_2026101101 -p 127.0.0.1:15432:5432 -d postgres:16-alpine
docker run --name body-state-hardening-redis-20261011 --label body-state.task=scheduling-hardening-v1 -p 127.0.0.1:16379:6379 -d redis:7-alpine
npm.cmd ci --no-audit --no-fund
node scripts/build-audit-tests.cjs
node artifacts/audit-runtime/tests/scheduling-hardening-unit.cjs
$env:DATABASE_URL='postgresql://postgres:hardening-local-only@127.0.0.1:15432/audit_regression_2026101101'
$env:AUDIT_DATABASE_NAME='audit_regression_2026101101'
$env:REDIS_URL='redis://127.0.0.1:16379'
node artifacts/audit-runtime/tests/audit-regressions.cjs
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
node tests/payment-init.cjs
node tests/admin-modal.cjs
node tests/admin-pwa.cjs
node tests/stage05-providers.cjs
```

Every integration run requires a fresh database; existing regression fixtures are intentionally not overwritten.
Create another `audit_regression_<digits>` database on that task-owned container for a repeat.
The default pool10 saturation observation must remain visible: 20 callers still produce one winner,
but some requests can time out while the claim's snapshot helper borrows another connection.
For a separate no-saturation concurrency control run set `POSTGRES_POOL_SIZE=40` in QA only.
This is NOT a production setting change or a fix to `claimSlot`.

Optional local browser smoke after a successful build:

```powershell
node scripts/prepare-hardening-qa.cjs
$env:ADMIN_USERNAME='hardening-qa'
npm.cmd run start -- -p 3300 -H 127.0.0.1
```

Use the synthetic credentials printed by the fixture script. Verify `/admin/calendar`, `/admin/slots`,
`/admin/bookings`: Moscow labels, Today selected day, dates, forms, breaks, profile timestamps,
mobile/tablet/desktop layout and protected deletion errors. Do not enter real client data.
For packaging verification prefer the standalone `server.js` produced by this application's build;
`next start` reports a standalone warning and is only used as a local smoke server here.
Unit tests spawn UTC/Moscow/Yekaterinburg/New York processes and cover DST and day/week/month boundaries.
Browser viewport emulation is not installed iOS/Android PWA certification.
