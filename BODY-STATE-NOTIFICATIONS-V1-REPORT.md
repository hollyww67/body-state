# Body State — Notification System V1

## Статус и границы

Локальная реализация Release A и подготовка Release B выполнены от действующего Scheduling V2 `dc6bab70fcc41f39ea5d94a55a4643457de09965`, ветка `feature/notification-system-v1`. Draft PR #3 не меняется и не объединяется. Новые флаги OFF по умолчанию. Production, schema021, cron guards, Nginx, DNS, старый mail VPS и реальные провайдеры в этой работе не изменялись; production SSH не использовался.

**Deployment/activation NOT APPROVED:** нужны отдельное разрешение, проверенные Postbox credentials/domain/quota, фактическая частота production reminders source и fresh backup/restore для schema022. Для MAX дополнительно нужны модерация бота, token, проверенный публичный HTTPS endpoint и разрешение регистрации webhook. Локальные mock результаты не являются реальной доставкой.

Ответственные: Петрович — интеграция/БД/финальные проверки; Макар — SMTP/шаблоны и backend MAX; Кузя (frontend-роль Петя) — настройки кабинета; Гриша — reset и scoped security review. Сеня подготовил изолированный QA harness; после ограничения доступности агента его проверки и расширение сценариев выполнил Петрович. Независимый финальный security sign-off после всех исправлений отдельно не заявляется.

## Компактная карта интеграции

| Точка | Существующее поведение → изменение |
| --- | --- |
| `slots.ts`, `admin-bookings.ts` | `enqueueAppointment` уже вызывается в booking transaction; V1 использует тот же hook. Создание, подтверждение, перенос, отмена, revision сохраняются. |
| `booking-payments.ts` | После проверки durable paid order и обновления booking создаётся уникальный paid event в том же PoolClient. Init уведомление «Оплачено» не создаёт. |
| `payment-lifecycle.ts` | В durable CONFIRMED transaction добавлен email event для заказов без booking. Refund-ветки не порождают новое paid email. Старое Telegram-поведение не заменялось. |
| `appointment_notifications` | Расширение существующей outbox, не вторая очередь. `engine=legacy` изолирован от V1, логический `event_key` уникален. Старые строки не backfill/replay. |
| `/api/cron/reminders` | Тот же защищённый endpoint; добавлена обработка V1. Расписания и guards не менялись. Перед включением обязательно подтвердить минутную частоту; старые документы этого не доказывают. |
| Account password reset | Сохранены account_users, bcrypt12, Redis sessions и session_version. При V1: issuance + hash + outbox атомарны, сетевой отправки в HTTP нет. Confirm блокирует account → token, потребляет один раз, повышает session_version, атомарно создаёт password_changed. |
| Account UI | `/account/notifications`: email status/address, MAX pairing/unlink, необязательные 24h/2h reminders; никакой рекламы. |
| Admin UI | Существующий журнал отправок расширен: безопасные статусы/ошибки/attempts, запрет legacy/uncertain replay; отдельное двухэтапное подключение MAX администратора. |

## Архитектура и безопасность

Business transaction → existing outbox → `FOR UPDATE SKIP LOCKED` claim → current-state validation → durable send marker → network вне PostgreSQL connection/advisory lock → безопасный ACK.

Сохранены действующие enum-имена: `processing` = sending, `accepted` = provider_accepted; принятие SMTP/MAX не означает доставку. Четыре автоматические попытки, exponential backoff; exhausted → failed/manual review. Неопределённый network outcome/падение после send marker → uncertain без автоматического или слепого ручного повтора. Падение до marker безопасно повторяется в пределах бюджета. Перед ACK повторно проверяется актуальность; устаревший in-flight исход сохраняется как uncertain. Exactly-once внешней доставки не обещается.

Новые активации ограничены монотонной durable границей `notification_channel_activation`; при каждом повторном включении нужен новый ACTIVE_SINCE. Non-reminder события старше 30 минут не догоняются, reminders допускают не более 5 минут опоздания. Перенос/отмена инвалидируют предыдущую revision; существующее legacy 24h email покрытие не дублируется V1 email. Worker имеет ограничение batch/time budget; производительность и backlog необходимо наблюдать при включении.

Reset: HMAC-SHA256 от случайного UUIDv4 и отдельного runtime ключа даёт криптографически непредсказуемый одноразовый 256-bit token. В token table только SHA256, в outbox только resetId, без plaintext token/URL. Worker повторно проверяет TTL, used_at и hash. Ключ не ротировать без отдельного плана действующих токенов.

MAX: фиксированный официальный API origin, header secret, потоковый лимит webhook 64KiB, private human messages, durable dedup+pairing transaction до HTTP200. Клиентские коды random32 bytes, hash-only, TTL5min; account locking, unlink/relink, уникальные identity. Административный webhook лишь сохраняет pending identity; привязка включается только дополнительным авторизованным подтверждением в админке. Dispatch проверяет роль, владельца и точную версию binding. Клиентские MAX сообщения не содержат имени, названия процедуры, контактов или медицинских подробностей — детали в защищённом кабинете. Critical failure alerts идут только в отдельный admin binding и не порождают рекурсивных alerts.

## Миграция и rollback

`022_notification_system_v1.sql` — после021, транзакционно через существующий migrate runner. Нет удаления business rows, изменения booking/payment tables или обратной миграции. Расширяются поля/ограничения outbox; legacy uniqueness сохраняется частичным индексом, V1 использует event_key. Новые таблицы: channel activation, account settings, MAX client/admin pairing/bindings/inbox.

Изолированная проверка001..022 сохраняет все исходные поля 5 synthetic uncertain + 4 failed legacy rows. Это проверка миграции на fixtures, а не заявление о production fingerprints или off-host restore актуальной production backup.

**Старый image не является notification-compatible fallback после заполнения V1 queue:** старый worker не знает engine/account/MAX events. Первичный rollback — оставить engine-aware app и отключить новые flags согласованным способом, сохранить все факты. Возврат к прежнему image требует отдельно проверенного fencing reminders worker; нельзя просто возобновить старый source над смешанной очередью. Детали в `docs/NOTIFICATIONS-SETUP.md`.

## Воспроизводимые проверки

Dedicated local Docker PG17 + Redis, loopback15435/16379, label `notifications-isolated-qa`, новые синтетические БД, pool10. Существующие QA/другие приложения не перезапускались. В тестах внешний provider network запрещён или инъецирован fake.

| Проверка | Результат |
| --- | --- |
| `node tests/notification-core.cjs` | 15 real-PG групп: atomic rollback,20 workers, paid dedup, revisions, no catch-up, retry/dead-letter, uncertain, pre-send crash recovery, legacy coverage, concurrent real reset consume, durable MAX/admin binding. |
| `node tests/notification-core-harness.cjs` | 53 integration cases,9 pool10 stress groups,21 Scheduling V2 cases; nested checkouts0. |
| `node tests/notification-reset.cjs` | Offline rate-limit/neutral response/TTL/reuse/session invalidation/rollback contracts PASS; real concurrency дополнительно проверена core suite. |
| `node --test tests/max-notifications.cjs` | 13 fake-provider/security cases PASS; forged/duplicate/oversize/replay-related one-time binding, auth/origin, role/version transport contracts. |
| `node tests/notification-smtp-templates.cjs` | SMTP mocks, десять шаблонов, HTML/text, MIME multipart в памяти, STARTTLS/certificate/header injection/privacy PASS. |
| TypeScript / ESLint | Выполняются на итоговом дереве; без live credentials. |
| Production build | Linux Docker штатный Turbopack build прошёл на промежуточном дереве; итоговый повтор и HTTP smoke должны быть подтверждены отдельно. Windows Turbopack отказал из-за внешнего node_modules junction; Windows webpack build прошёл. |
| GitHub CI | Новый `notifications-v1.yml`, exact PR head checkout, isolated deps/tests/build, без deployment. Локальные результаты не выдаются за hosted CI. Фактический статус проверять для текущего PR SHA. |

Локальные generated логи: `artifacts/notification-v1/` (не коммитятся). Реальные inbox delivery, provider accepted/ACKlost fault injection на живых сервисах, физические iOS/Android PWA и actual200% zoom не проверялись. Fake/MIME тест не равен сетевому SMTP STARTTLS end-to-end тесту. Юридическая гарантия соответствия или актуальная проверка DNS не заявляются; действующие сервисные согласия и политика требуют owner/legal review перед MAX.

## Раздельные поставки

**A — Postbox:** core+SMTP+templates+recovery+booking/order paid emails+settings+monitoring реализованы. MAX flag может оставаться OFF. Активация BLOCKED до Postbox/cron/preflight/разрешения.

**B — MAX:** adapter+webhook+client/admin binding+routing+reminders реализованы и подготовлены для fake/isolated QA. Активация BLOCKED до verified business/approved bot/token/public webhook verification и отдельного допуска. Никакой автоматической регистрации подписки или Long Polling.

Владелец настраивает Postbox identity, postbox.sender/yc.postbox.send, DKIM/SPF/DMARC, Reply-To и квоты; MAX business moderation/token/HTTPS secret subscription. Секреты передавать только защищённым runtime env, не в Git/отчёт/публичный чат. Полный ENV contract и официальные ссылки: `docs/NOTIFICATIONS-SETUP.md`.
