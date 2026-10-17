# Stage 3.1 — изолированные scheduling-регрессии

Ответственный: Гриша (QA/security). Дата: 2026-10-17.

## VERIFIED — окружение и происхождение runtime

Использован существующий `artifacts/audit-runtime`, подготовленный основным агентом через `scripts/build-audit-tests.cjs`. Повторная компиляция и изменения исходников не выполнялись.

- Проверено точное совпадение результатов transpile текущих исходников с 146 compiled файлами в `src/lib` и `src/app/api` (CommonJS, ES2022, ReactJSX, esModuleInterop).
- Три compiled runner побайтно совпадают с `tests/`.
- `git diff --name-only 83c353c -- src/lib src/app/api migrations` вернул пустой результат.
- Запущены только ранее остановленные `body-state-stage3-regression-pg` и `body-state-stage3-regression-redis`.
- Через Docker inspect подтверждены loopback-привязки: PostgreSQL `127.0.0.1:15432 -> 5432`, Redis `127.0.0.1:16380 -> 6379`.
- PostgreSQL ответил `accepting connections`, Redis — `PONG`.
- До создания обе целевые БД отсутствовали. Созданы только `audit_regression_2026101708` для V2 и `audit_regression_2026101709` для pool.
- Каждый integration runner применил миграции 001–022 только в свою новую БД; результат: `PostgreSQL schema is up to date`.

Переменные процессов: `DATABASE_URL` с пользователем `postgres`, loopback host/port и соответствующей audit-БД; синтетический пароль не включён в отчёт. `AUDIT_DATABASE_NAME` соответствует БД; `POSTGRES_POOL_SIZE=10`, `POSTGRES_SSL=false`, `REDIS_URL=redis://127.0.0.1:16380`, `NODE_ENV=test`. Эти значения выставлялись только в дочерних PowerShell-процессах, ENV-файлы не менялись.

Guard V2 требует host `127.0.0.1`, port `15432`, имя `/audit_regression_[0-9]+` и pool=10. Guard pool дополнительно требует совпадение URL pathname с `AUDIT_DATABASE_NAME`.

## VERIFIED — команды и итоги

Запуск из корня `.scheduling-v2/source` после установки перечисленных переменных:

```text
node artifacts/audit-runtime/tests/scheduling-hardening-unit.cjs
node artifacts/audit-runtime/tests/scheduling-v2.cjs
node artifacts/audit-runtime/tests/scheduling-pool.cjs
```

Все три процесса завершились с exit code 0.

| Runner | Фактический результат |
| --- | --- |
| scheduling-hardening-unit.cjs | A01 PASS; A03 PASS в UTC, Europe/Moscow, Asia/Yekaterinburg, America/New_York |
| scheduling-v2.cjs | passed=21, nestedCheckouts=0; финальная проверка pool.waitingCount=0 прошла |
| scheduling-pool.cjs | passed=9, pool=10, nestedCheckouts=0; pool.waitingCount=0 после каждой группы |

### VERIFIED — hardening

A01: независимые scalar/hash-векторы, зарезервированное поле Password, проверка terminal и status tokens. Только локальные вычисления, платёжные операции не создавались.

A03 в каждой из четырёх TZ: ввод/вывод времени, группировка, Today/day/week/month, DST, перерывы, итерация дней недели.

### VERIFIED — все 21 группы V2

1. Нормализация дат, московская полночь, weekdays, процедура целиком помещается в рабочие часы.
2. Multi-date apply: фактическое число вставок, dedupe, idempotent repeat.
3. Stale preview отклоняет commit без частичных вставок.
4. Закрытие дня с активной записью откатывает exception и blocks.
5. Vacation/temporary hours действуют между услугами; очистка сохраняет manual breaks.
6. Точное consent-подтверждение admin create, атомарный отказ создания, duration не переписывается.
7. Same-slot reschedule — no-op; append-only old/new history защищает оба slot.
8. Правдивая pagination диапазона и непосредственные admin gates.
9. Конфликты версий template откатывают activation; dry run/cron идемпотентны и сохраняют exceptions.
10. Синтетический slow provider не удерживает scheduling lock/connection; stale in-flight остаётся uncertain.
11. Template period preview/apply, stale edit, copy, window close/reopen выполняют реальные локальные мутации.
12. 5000 фактических вставок; 5001 отклоняется; повтор даёт zero inserts, durations сохраняются.
13. Booking vs close-window: один победитель, без частично сохранённого состояния.
14. Server totals/search/pagination и account linking требуют явного identity-подтверждения.
15. A05: обе клиентские точки входа и разные написания UUID используют общую реальную Redis quota до scheduling lock.
16. A05: development fallback считает конкурентные попытки; production-ветка отказывает без Redis (локальная проверка ветвления, не production-запуск).
17. Generator breaks блокируют существующие начала, conflict rollback выполняется целиком.
18. Синтетический provider timeout остаётся uncertain без retry и освобождает pool/lock.
19. Внедрённый отказ после первой изменённой даты откатывает multi-date exception целиком.
20. Admin request-key retries возвращают одну запись; mismatched reuse не меняет данные.
21. Изменение направлений опубликованного template выводит старые свободные начала из оборота без отмены приёмов.

### VERIFIED — все 9 групп pool

1. 10 параллельных API claims: один 201, остальные 409 (354 ms).
2. 20 параллельных API claims: один 201, остальные 409 (283 ms).
3. 30 параллельных API claims: один 201, остальные 409 (387 ms).
4. 30 mixed-service claims на пересекающийся интервал, включая program/promo (480 ms).
5. 30 успешных разных program claims и конкурентные legacy price/promo reads (1660 ms).
6. 30 одинаковых idempotency requests переиспользуют одну запись и notifications (367 ms).
7. Claims конкурируют с reschedule/cancellation/breaks при pool=10 (4150 ms).
8. Invalid promo и injected insert failure полностью откатывают occupancy/notifications под нагрузкой (874 ms).
9. Другие scheduling helpers переиспользуют transaction client (261 ms).

Финальные assertions pool suite также подтвердили отсутствие пересекающихся активных интервалов и orphaned appointment_notifications. Сообщения `[Booking] Could not reserve appointment` появились в группе намеренно внедрённых отказов; группа и финальные assertions прошли.

## VERIFIED — идентификаторы runner

SHA-256 compiled runner:

```text
scheduling-hardening-unit.cjs ca1a530430c86aced383688fcd9e252ab3390cfb93da7d8a1419751354a7c536
scheduling-v2.cjs            6f6a1eb70097a118a027d9228080b4c420acfc80548edc03f717b4e44922a915
scheduling-pool.cjs          12cdca2d8ffe4b261e3888fe0945c64a823c92bd2c8434f3b37799870bc0fb0c
```

## NOT TESTED — границы доказательств и остаточные риски

Это реальные локальные PostgreSQL/Redis-регрессии поверх compiled source с synthetic fixtures. Auth/session и внешние уведомления подменяются runner. HTTP(S) request/fetch запрещены runner; сценарии provider timeout/slow response используют тестовые подмены. Реальные оплаты, отправка email, вызовы внешних providers, production и design-preview БД не использовались.

Браузерный UX, геометрия, focus/scroll, реальная авторизация/RLS, production infra и реальные провайдеры этим прогоном не подтверждены. TypeScript/lint/production build в этой задаче не запускались.

## VERIFIED — проблемы, рекомендации и состояние после запуска

Подтверждённых продуктовых ошибок в выполненных группах нет; серьёзность дефектов не назначается. Предыдущий блокер `Cannot find module ../src/lib/tbank.js` при запуске исходного unit runner обходится штатным запуском уже подготовленного compiled runner: он прошёл без изменения backend.

Рекомендация Петровичу: использовать эти результаты как scheduling acceptance текущего состояния backend; browser acceptance Stage 3.1 оценивать отдельно. При изменении backend/runtime или runner потребуется новый прогон на новых изолированных БД.

Обе synthetic БД сохранены для разбора. Два разрешённых контейнера оставлены запущенными. Другие контейнеры и БД не изменялись. В рамках текущего поручения записан только этот отчёт; app/backend и существующие тесты не редактировались. Commit/deploy не выполнялись.
