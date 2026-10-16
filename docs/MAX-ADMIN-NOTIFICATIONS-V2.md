# MAX admin booking details — release contract

Base: deployed `5d3146fc6402c50adb4ada24a255944ab577e7d7` (schema022,
Email V1 and MAX admin-only). This feature is NOT permission to transmit client data.

## Privacy gate — BLOCKED

The published `/privacy` currently prohibits personal data in external messenger
notifications. The owner confirmed that updated legal/provider conditions are not
available. Do not deploy/activate contact-bearing messages, send real contacts,
rewrite past consents, or replay old notifications to make a test pass.

Before activation the operator/legal adviser must establish an appropriate processing
basis, the messenger/provider role and applicable terms, necessary disclosures and
security/retention arrangements, and whether new consent is needed for the relevant
customers. Updating a web page alone does not establish a legal basis retroactively.
No claim of comprehensive legal compliance is made by these technical tests.

## Opt-in

The default remains the existing brief administrative message. Only after the legal
gate and separate operator release approval may runtime include:

    NOTIFICATIONS_MAX_ADMIN_DETAILS_ENABLED=true
    NOTIFICATIONS_MAX_ADMIN_DETAILS_ACTIVE_SINCE=<actual activation UTC ISO timestamp>

MAX must already be enabled and explicitly admin-only. Missing/invalid settings,
events before this new boundary, or a disabled details flag must not disclose
contacts. Preserve existing Email/MAX channel activation timestamps and quotas.
Never replay older failed/uncertain events or reset activation/budget state.

## Data and consistency

- Administrative outbox retains only trusted booking ID/service, revision and
  old/new transfer times; client names, phone and email are read at resolution.
- Runtime service allowlist and UUID validation precede table-name interpolation.
  Event identity must agree with the stored logical event key.
- Same transactional PoolClient is used for booking/history/account reads.
- Rescheduled old/new times must match the latest saved transfer and current slot.
- Obsolete non-payment revisions are cancelled; missing/forged/inconsistent data
  are marked failed with safe `admin_booking_unavailable` / `admin_event_invalid`.
  A paid fact with changed revision is retained as failed for review, not discarded
  as a cancelled payment. No orders/bookings/payment settlement are changed.
- Missing/invalid contacts show `Не указан`. Account email fallback requires the
  booking's linked, active account with `verified_at`; this is not an independent
  guarantee that an email address belongs to a particular person.
- Snapshot title or fixed service catalogue; no notes, medical history, diagnoses,
  addresses, passport/card details, tokens, service price-as-payment amount or
  booking `updated_at`-as-payment date are included.
- Plain text, bounded fields, control/bidi removal, explicit Europe/Moscow times,
  and a fixed HTTPS admin URL with validated UUID. No user-supplied URL is used.

## Binding authorization

Admin MAX transport uses one dedicated PoolClient and a session advisory lease on
the same key `(221022,1)` as revoke/rebind. Binding identity/version are checked on
that session. No transaction or second pool checkout is held during HTTP. An
unproven acquisition/unlock requires destroying the session. Revocation that
arrives after provider admission waits for that in-flight send; already accepted
messages cannot be recalled. Once revocation commits, an old binding cannot admit
a new send. Uncertain provider outcomes are never automatically retried.

## Event coverage (unchanged producers)

All three booking services support created, initial confirmed, rescheduled,
cancelled and paid events. Existing semantics are intentionally preserved:

- An immediately confirmed new booking emits confirmed, not an extra created.
- Confirmation after settlement is not a separate admin notification: existing
  filtering accepts confirmed only at revision0; the paid notification carries
  the current booking status instead.
- No-show currently enters the cancellation pipeline; no new attendance event.
- Program enrollments, store orders and generic consultation forms are not these
  three booking tables; no new admin events have been added for them.
- Paid replay does not recreate a notification missed before activation/binding.
- Existing 30-minute maximum age and transactional event keys remain unchanged.

## Verification and eventual release

Run `node --test tests/admin-max-notification.cjs tests/max-notifications.cjs`,
`node tests/notification-core.cjs`, Email/reset regressions, TypeScript, ESLint and
exact-HEAD CI. Tests use synthetic fixtures and fake providers only; real PG lease
tests verify revocation waits and the sender holds no SQL transaction.

After legal approval and independent review: build a new immutable exact-SHA image,
run Docker smoke, prepare same-schema engine-aware rollback with details OFF,
perform protected app-only switch, preserve Email/budget, token, secret, subscription,
cron and schema022, then supervise natural minute workers. Do not re-register the
webhook or create client bookings/payments for acceptance.

One separately controlled, durable one-attempt synthetic admin smoke is required
after an approved deployment. The live smoke mechanism and receipt confirmation
remain release work; no live smoke was sent during blocked local development.
