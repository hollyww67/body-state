# Release A — отдельный минутный Notification V1 scheduler

Ответственные: Петрович — интеграция/допуск; Макар — SMTP budget;
Сеня — guard/cron; Гриша — независимая проверка. Это подготовка, не разрешение live.

## Архитектура

| Source | Cadence | Работа |
| --- | --- | --- |
| Existing system reminders | `0 7 * * *`, без изменений | Только legacy sync/queue |
| Новый отдельный system notifications-v1 | `* * * * *` | POST `/api/cron/notifications-v1`, только V1 |
| Root business source | Disabled | Не активировать |

Два разных задания, не два producer одной V1-очереди. Legacy daily route больше
не вызывает V1. Минутный route не импортирует legacy sync/worker. Оба требуют
существующий CRON_SECRET; system header не заменяет аутентификацию. Доступ
к секрету означает доверенного оператора, не отдельную криптографическую identity.

Guard использует свой durable каталог, pause, lock и UTC epoch-minute key;
текущий установленный legacy guard не заменяется. DB022 admission сериализуется
по singleton row, допускает только текущую DB minute, сохраняет каждую принятую
минуту и run UUID. Повтор, rollback часов и историческая минута не выполняются.
Нет timed lease/replay: crash/unknown оставляет active_run, блокирующий будущие runs.

Batch максимум10, transport ожидание10s, admission budget20s, SQL statement3s/
lock1s. Deadline повторно проверяется после SQL, непосредственно перед transport.
Guard HTTP process имеет hard deadline не более50s и конца исходной минуты.
Это не отмена внешнего SMTP: timeout после send marker означает uncertain,
не «не отправлено». Отсутствие lock/curl не доказывает завершение приложения.

Quota exhaustion — локальный отказ до SMTP: attempts не расходуются, send marker
очищается, следующий attempt не ранее минуты, batch прекращается. Неизвестные
provider outcomes никогда не получают такую компенсацию. Все reservations
считаются использованными независимо от результата SMTP.

Общий бюджет legacy+V1 хранится в logged PostgreSQL scope/reservations, не Redis.
Redis/app/VPS restart не обнуляет окно1s/24h. Стабильные
`SMTP_BUDGET_SCOPE`, `SMTP_BUDGET_PER_SECOND`, `SMTP_BUDGET_PER_DAY`,
`SMTP_BUDGET_LEGACY_RESERVE_PER_SECOND`, `SMTP_BUDGET_LEGACY_RESERVE_PER_DAY`
обязательны при email ON; `SMTP_BUDGET_QUOTAS_CONFIRMED=true` — подтверждение
владельцем фактической квоты, не её автоматическое получение. Значения должны
быть не выше оставшегося безопасного headroom с учётом предыдущих24h и внешних
отправителей; резерв legacy меньше общего лимита. Policy mismatch блокирует
отправку, scope не менять ради сброса лимита. Восстановление старого backup
также требует сверки расходов у Postbox. При email OFF legacy без budget I/O.
Это лимит SMTP attempts; задержки сети могут менять фактическую скорость
приёма на стороне провайдера, поэтому его ограничения/429 остаются авторитетными.

## Gates до отдельного production GO

1. Подтвердить exact source SHA, image ID/platform digest, hosted CI этого SHA,
   Docker HTTP smoke и результаты process/SQL tests. Не собирать из dirty context.
2. Fresh read-only preflight: schema021, guard hashes/state, root disabled,
   topology loopback3000, cron expressions, container identities, disk budget.
   Снимок прошлого preflight не считать свежей проверкой. Никакого catch-up.
3. Fresh schema021 backup, off-host restore и rehearsal022 в изоляции;
   сверить history/notification/payment cases до/после. Production baseline именно021.
   Если обнаружена ранее применённая другая версия022 — STOP: filename migrator
   не добавит новые таблицы; требуется отдельный upgrade plan, не ручная правка ledger.
4. YC owner evidence: verified identity разрешает новый SMTP_FROM и сохранённый
   legacy EMAIL_FROM; DKIM status/selector, SPF/DMARC/alignment, postbox.sender,
   API key scope yc.postbox.send, фактические per-second/24h квоты и usage.
   AUTH235 не подтверждает эти пункты. Внешние отправители с общей квотой должны
   быть учтены отдельно; app limiter их не видит.
5. Защищённый runtime ENV: стабильный NOTIFICATION_RESET_KEY, отдельные
   EMAIL_FROM/SMTP_FROM, действительный Reply-To по решению владельца,
   подтверждённый aggregate budget, новая монотонная ACTIVE_SINCE.
   MAX=false, MAX webhook не регистрировать.
6. Тестовый получатель уже согласован приватно. Это НЕ разрешение отправки.
   До отдельного send approval — ноль MAIL/RCPT/DATA, включая smoke.

## Будущая установка и cutover — НЕ выполнены

1. Supervised pause существующего legacy guard и нового guard; DB worker paused.
   Drain wrapper недостаточен: проверить app/provider/DB active work и uncertain.
   Не менять cron expressions существующих jobs, root source не включать.
2. Только после GO: expand schema021→022, app-only switch на exact engine-aware
   image со scheduler/email flags OFF. Проверить legacy dispatch engine='legacy'
   и отсутствие новых V1 sends; никаких реальных платежей для smoke.
3. Опубликовать root-owned отдельные guard/front/config/cron из
   `deploy/notification-scheduler/`, следуя его RUNBOOK. State/fsync/ACL/path и
   SHA проверить отдельно. Ровно один новый system entry; отсутствие дубликатов
   в root/systemd/cron проверяет оператор. Старые originals напрямую не вызывать.
4. Проверить budget/quota/identity gates. Согласованно установить новые flags,
   ACTIVE_SINCE и quota policy. Убедиться, что queue не содержит replay старых
   случаев. DB control снять с pause только при active_run IS NULL.
   Новый guard resume — последним. Legacy guard resume по сохранённому runbook.
5. Наблюдать естественные минуты: OS claimed/done + DB runs done + row outcomes.
   Не выдавать HTTP200/SMTP accepted за доставку. Проверить 07:00 daily separately
   естественным запуском, не ручным endpoint. MAX остаётся OFF.

## Recovery / primary rollback после022

Первичная мера — pause нового guard, затем DB pause; scheduler/email OFF через
согласованную конфигурацию. Сохранить текущий engine-aware image, V1 queue,
budget reservations, run ledger и историю. Не возвращаться к старому image,
который не фильтрует engine. Не откатывать022 и не удалять события.

Если guard/app прерван: оба pause, прочитать обе ledger, найти active_run и все
V1 processing/send_started_at; проверить существующие server processes и transport
activity. Перед снятием fence доказать отсутствие поздней записи/отправки.
Сверить факты принятия у провайдера. Если результат неизвестен — сохранить
uncertain, не повторять письмо. Только отдельное решение разрешает завершить
run/reconcile marker; ни SQL по таймеру, ни automatic acknowledge не допустимы.
DB active_run очищается отдельно после сверки, не вместе с blind resend.
Guard acknowledge сохраняет использованную minute. Resume только на будущей
текущей minute; изменение ACTIVE_SINCE при повторной активации предотвращает backfill.

Три historical payment_init_uncertain и legacy failed/uncertain остаются неизменны.
Ошибка Postbox не откатывает запись/платёж: lifecycle только транзакционно создаёт
outbox, транспорт работает независимо. Zoom/PWA не относится к этому patch.
