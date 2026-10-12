# Scheduling V2 — isolated release gate

Baseline: `b4f3531ccb6b26b5bfe622d0da16c9329e4d2adb`. No production deployment is included.

## Test prerequisites

Use three fresh, disposable PostgreSQL databases named `audit_regression_<digits>`.
Tests refuse a database URL other than `127.0.0.1:15432` and require pool=10.
Use isolated Redis on `127.0.0.1:16379`. No production data or provider credentials.
Each integration suite runs all additive migrations itself. Never reuse a suite database.

```sh
node scripts/build-audit-tests.cjs
POSTGRES_POOL_SIZE=10 DATABASE_URL=<first-isolated-url> node artifacts/audit-runtime/tests/audit-regressions.cjs
POSTGRES_POOL_SIZE=10 DATABASE_URL=<second-isolated-url> node artifacts/audit-runtime/tests/scheduling-pool.cjs
POSTGRES_POOL_SIZE=10 DATABASE_URL=<third-isolated-url> REDIS_URL=redis://127.0.0.1:16379 node artifacts/audit-runtime/tests/scheduling-v2.cjs
node artifacts/audit-runtime/tests/scheduling-hardening-unit.cjs
npx tsc --noEmit
npx eslint src
node tests/payment-init.cjs
node tests/admin-modal.cjs
node tests/admin-pwa.cjs
node tests/stage05-providers.cjs
node tests/dependency-regressions.cjs
npm run build
```

Expected groups: 47 regression + 9 pool stress + 21 V2. A failed assertion is fatal.
Integration HTTP handlers are invoked in-process with real PostgreSQL. Account/admin/provider
fixtures are offline; the V2 rescheduling-quota group additionally uses real isolated Redis.
No real payment, email, SMS, fiscalization or customer notification is permitted.

## Built-app UI gate

`Dockerfile.SchedulingQA` reuses the local hardened dependency builder, runs Webpack,
and starts the resulting standalone app. It is a local QA convenience, NOT a production
Dockerfile replacement. Final release artifacts must be built using the standard Dockerfile.

`scheduling-v2-browser-fixture.cjs` only seeds the explicitly named synthetic browser DB.
Keep app/PostgreSQL/Redis on an INTERNAL network. The local proxy may expose only localhost.
Do not mount production environment files, uploads, backups or restored customer databases.

Verify workweek save, month preview/apply, five individual dates, day closure, manual break,
calendar month/week/day, exact-slot booking with real consent checkbox, cross-service
availability, move with old/new history, cancellation, restored windows, reload, mobile,
and two calls to the existing extend-schedule endpoint. Check 390/768/1280 widths,
keyboard focus/Escape, modal scrolling, background refresh and 200% browser zoom.
Report unsupported physical-PWA/browser-zoom checks explicitly rather than claiming PASS.

## Deployment stop point

Migration 021 is additive and has no fabricated event backfill. It introduces durable
templates/exceptions and append-only booking history, and protects referenced historical slots.
Review and apply it separately from an app-only container switch, only after explicit approval
and a fresh verified backup. Never run automatic down migrations or restore a stale database.

The pre-V2 hardened image is NOT a fully verified V2 rollback: its schedule-break editor
does not understand template-owned restrictions. Prefer a tested V2-compatible fallback or
forward fix. Preserve V2 tables, event journal, payment facts and bookings on rollback.
No change to cron frequency, SMTP, SMS, DNS or production Nginx is included.
