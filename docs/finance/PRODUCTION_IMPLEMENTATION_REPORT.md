# BODY-STATE.RU — PRODUCTION IMPLEMENTATION REPORT

Дата: 11 октября 2026. Этап: Stage 0.6. Итог: **PARTIAL**.

Изменения действительно развёрнуты. Git-ветка опубликована; полная приёмка закрытой production-админки пока не завершена. Stage 1 не начат.

## Выпуск

| Параметр | Факт |
| --- | --- |
| Production VPS | 85.198.71.172 |
| Каталог | /opt/doctor-site |
| Canonical repository | hollyww67/body-state |
| Ветка на VPS | release/stage06-admin-pwa |
| Исходный GitHub HEAD | 62ecb02b6194bed306a34cfe962d2f7deaf02dd1 |
| Коммит сохранения production baseline | 5874eb7 |
| Коммит исходников приложения | ffbf8cb065b4046d7d9beb3ee02a2c5dcd1503f7 |
| Образ | doctor-site-app:stage06-ffbf8cb |
| Предыдущий image ID | sha256:3399ebffd8d4346e40b1c536e34f1fbf620caa8982283e037831a47747d380aa |
| Новый image ID | sha256:ff580d271a7c973528ecec391020aa52f61b32151125bf22e9da008581ab127b |
| Запуск нового контейнера | 2026-10-11T08:21:07.541446735Z, 11:21 МСК |
| Переключение Compose | Около 0,9 секунды; не измерение гарантированного zero downtime |
| Код изменён | Да, на VPS |
| Образ собран | Да, на VPS |
| Образ развёрнут | Да, обновлён только app |
| Production проверен | Частично: health, публичные страницы, маршруты, логи; закрытая UI-приёмка ожидает входа |

APP_VERSION=stage06-ffbf8cb закреплён в существующем .env.production. Другие значения окружения не изменялись. Предыдущий образ сохранён под rollback-stage06-20261011.

## Что исправлено

Перенесён подготовленный admin-pwa-modal.patch после проверки применимости к текущим исходникам. Сверка до изменений дала прежний fingerprint:
`806f1501454124c7c8b129b3dda74dd74fe9a32aeaf47819ed2ff7dfd30a2c92`.

Модальные окна вынесены через React Portal и native dialog.showModal() в верхний слой браузера. Нижняя навигация больше не должна перекрывать подтверждение удаления. Добавлены управление фокусом, блокировка фоновой прокрутки, safe-area/VisualViewport, защита от повторного запроса и сохранение сообщения при ошибке.

Затронуты подтверждения в записях, заказах и слотах; формы записи, карточки и формы календаря используют общий AdminModal. Серверная бизнес-логика этих действий не менялась.

Из Docker startup убран автоматический запуск миграций. Теперь schema changes требуют отдельной согласованной операции. Существующие 20 SQL-файлов не изменены, миграции в production не выполнялись.

## Изменённые файлы

- src/components/admin/AdminConfirmDialog.tsx
- src/app/admin/admin.css
- src/app/admin/bookings/page.tsx
- src/app/admin/orders/page.tsx
- src/app/admin/slots/page.tsx
- src/app/admin/calendar/page.tsx
- package.json, package-lock.json
- Dockerfile, .dockerignore, .gitignore
- .github/workflows/deploy.yml
- tests/admin-modal.cjs, tests/admin-modal-browser.mjs
- tests/dependency-regressions.cjs, tests/audit-regressions.cjs
- tests/stage05-providers.cjs, tests/video-rooms.cjs
- scripts/stage05-env.cjs, scripts/stage05-test-db.cjs
- scripts/stage05-secrets.cjs, scripts/stage05-checks.cjs
- docs/admin/ADMIN_PWA_MODAL_FIX_REPORT.md — исторический отчёт Stage 0.5; его прежний запрет deploy не относится к этому этапу.

Дополнительная документация выпуска: этот отчёт, deploy/stage06-rollback.yml и scripts/verify-stage06-restore.cjs. Изменение .env.production касается только селектора образа и не включено в Git.

## Проверки

| Проверка | Результат |
| --- | --- |
| TypeScript | PASS локально и в Linux Docker build |
| ESLint src | PASS локально и в Linux Docker build |
| Modal event regressions | PASS: 6 сценариев, включая повторный запрос и ошибку |
| Admin PWA unit | PASS: manifest, icons, service worker lifecycle, offline fallback |
| Payment Init / transport unit | PASS: успех, отказ, timeout, некорректный ответ; без банка |
| Offline payment/KKT fixtures | PASS; не реальная фискализация |
| Основные integration tests | PASS: 34 сценария, отдельная локальная PostgreSQL DB |
| Video integration tests | PASS: 36 проверок, локальные PostgreSQL/Redis |
| Dependency regressions | PASS локально и в Linux build |
| Production build | PASS: 116 страниц, финальный образ собран |
| Проверка production environment | PASS в одноразовом контейнере, значения секретов не выводились |
| Ограниченный secret-signature scan | PASS, 0 находок; не исчерпывающий аудит секретов |
| Production dependencies npm audit | PASS: 0 известных уязвимостей |
| Полный npm audit с dev dependencies | 10 замечаний: 8 high, 2 moderate; не исправлялись массовым обновлением |

Первый Docker build остановился из-за ошибочного включения DB-зависимого video test в build stage. Тест перенесён в изолированную проверку, не отключён. В нём исправлен жёстко заданный origin 3100: теперь используется проверенный локальный origin тестового окружения. Защита origin в приложении не ослаблялась.

В integration mock исправлено соответствие существующему T-Bank transport. Реальные платежи, возвраты, письма и DELETE клиентских данных не выполнялись.

## Browser QA

На синтетической локальной БД, с кодом текущего релиза:

- PASS: 320×568, 375×667, 390×844, 393×852, 430×932, 844×390, 1280×800; дополнительно 320×280.
- PASS: native :modal, кнопки находятся внутри viewport, hit test подтверждает отсутствие перекрытия, touch targets ≥44px.
- PASS: Tab/Shift+Tab, Escape, «Отмена», возврат фокуса и снятие scroll lock.
- PASS: вход тестового администратора, открытие/закрытие формы новой записи, карточки заказа, форм записи и перерыва в календаре.
- Скриншот: локальный .stage-0-6/modal-390x844.png. Это тестовая админка, не доказательство авторизованной production-проверки.

**DEVICE QA NOT VERIFIED**: реальные iOS/Android, установленная PWA, экранный диктор, системный крупный шрифт и настоящая мобильная клавиатура недоступны. Desktop responsive не обозначен как device PASS.

Production browser: расписание загрузилось, форма записи отображается, клиентская форма входа отображается. Ошибок browser console на проверенной странице записи не обнаружено. Закрытые карточки клиентов/заказов, календарь, платежные ссылки и модальные окна на production ожидают обычного входа администратора. Пароли и права доступа для обхода входа не менялись.

## Security dependency work

| Пакет | Было → стало | Проверка |
| --- | --- | --- |
| nodemailer | 9.1.1 → 10.0.9 | Минимальная версия, закрывающая заданные advisories; Node 24 совместим с требованием ≥20 |
| sharp | 0.35.4 → 0.35.5 | Обновлены также нативные пакеты/libvips; в работающем контейнере librsvg 2.63.2 |
| source-map-js | 1.2.1 → 1.2.2 | Все найденные потребители используют исправленную версию |

Независимые read-only investigation/review не выявили конкретного нового bypass или регрессии. Использован skill fix-finding для анализа путей входа, совместимости и проверки кандидата. React Best Practices использован при проверке lifecycle/focus, verification — для разделения UI/API/DB доказательств.

Проверены malformed recipient/comment parsing и обычные адреса, кириллические заголовки/Reply-To, результаты SMTP mock без сети; PNG/JPEG/WebP/GIF и некорректные данные в обоих upload handlers; SVG и операции QR-композиции; валидные source maps и некорректные offsets. Дополнительный независимый прогон проверил вложенные offsets и адреса.

Подтверждено удаление уязвимых версий и прохождение focused regressions, **не** полная exploit-сертификация всех исторических advisories. Реальная SMTP/TLS-доставка, специфический memory-corruption SVG exploit и банковский sandbox не проверялись. Почтовый сервер и его настройки не менялись.

Первичные источники: [Nodemailer v10](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0), [recipient advisory](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-g57g-f23g-4646), [sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js fix](https://github.com/7rulnik/source-map-js/pull/79).

Оставшиеся dev advisories относятся к ESLint/Tailwind/glob цепочкам: @next/eslint-plugin-next, brace-expansion, braces, chokidar, eslint-config-next, fast-glob, micromatch, postcss-nested, postcss-selector-parser, tailwindcss. Требуют отдельного совместимого обновления build-инструментов; нулевой production audit не означает нулевой общий audit.

## Backup / restore

Backups на VPS: /opt/doctor-site/backups/stage06-20261011, доступ root. Копия исходного backup скачана вне VPS в локальную .stage-0-6/stage06-20261011. Архивы содержат конфигурацию/персональные данные, не предназначены для Git или публикации.

PostgreSQL pg_dump -Fc выполнен до изменения исходников, 10 октября около 23:16 UTC / 11 октября 02:16 МСК. Файловые архивы сделаны последовательно: это не атомарный межсистемный snapshot БД и uploads. Для UI rollback восстановление БД не требуется и не должно затирать записи, поступившие после backup.

| Артефакт | SHA256 |
| --- | --- |
| database.dump | 748b69c44d82c8317af01be1e009cc271adf0081d05fe7038785c7598e0771d1 |
| source.tar.gz | b08eb77e6aa5470cc4fd62e17ac877a749578dda274cc9b76915f2f43375f68e |
| config-private.tar.gz | a45d2fe550dfd8069894faf95b141b9ac84239f4da4c1c5a528aca9f7bf0a8ea |
| config-source-extra.tar.gz | 0a225b1967bdb8e1fd6e8060408f68cc38ebc34e65609f3dc4217cbf8b9dde36 |

Все четыре checksum совпали после скачивания. Архивы читаются. Полный pg_restore --exit-on-error --no-owner --no-privileges в отдельную локальную stage06_restore_20261011 прошёл: 34 таблицы, 3 535 строк суммарно, 20 миграций, 126 ограничений, 96 индексов, 0 невалидированных ограничений. Количество ограничений/индексов совпало с production. Приложен скрипт read-only проверки: восстановленная БД + настоящий compiled health handler + локальный Redis дали status ok.

Это проверка полного восстановления данных и схемы и health handler, не запуск всех пользовательских сценариев на копии персональных данных. Точное совпадение всех строк с живой БД после момента dump не заявляется. Production ownership/grants при изолированном restore намеренно не воспроизводились.

Причина 31/34 доказана: старый dump предшествует миграции 019. В старой восстановленной схеме нет appointment_notifications, payment_cases и payment_case_history; все три создаёт 019_booking_journey.sql. Это не потеря таблиц при свежем restore.

## Git workflow

GitHub main не был скопирован поверх production. В /opt/doctor-site создана ветка на основе подтверждённой remote history, затем зафиксировано работающее состояние и отдельный release commit. Старый dirty checkout /var/www/doctor-site не сбрасывался.

В текущем GitHub HEAD .github/workflows отсутствует; локальный старый deploy.yml заменён ручным check-only workflow, без SSH/PM2 и автоматического push-trigger. В Git исключены env, dumps, backups, uploads и runtime output. Force push не выполнялся.

Прямой HTTPS push с VPS не имеет credentials для записи. Публикация выполнена через подключённый GitHub-аккаунт в отдельную [ветку release/stage06-admin-pwa](https://github.com/hollyww67/body-state/tree/release/stage06-admin-pwa), без изменения main и force push. Успешный GitHub CI пока не заявляется: workflow ручной, запуск отдельно не выполнен.

GitHub API создаёт собственные метаданные коммитов, поэтому SHA отличаются от VPS. Побайтовое совпадение всех трёх source trees проверено:

| Снимок | VPS commit | GitHub commit | Общий tree SHA |
| --- | --- | --- | --- |
| Production baseline | 5874eb7045154b77759a553ff88c2366342b3f4b | bd76ec63ef47557cfd9c432c350b48682c595f7e | e24ab6c3c865221e11de400a3fe9476bd6ca9ca6 |
| Исходники развёрнутого приложения | ffbf8cb065b4046d7d9beb3ee02a2c5dcd1503f7 | 3fd8d7e5014baab19f794bb5f5b7253bcd8e0934 | e9f0efbb0bc57854bac1f575f1df9566156587a5 |
| Исходный отчёт/rollback | 17a7b1b803994f553064ff2cccbb0486302372f2 | 0463f89a9c8552f918f5b618d4d7ce7dfb6fe2d8 | ee629251f970c09aabd9d8c8c373f93fddd3699c |

Оригинальные VPS-коммиты сохранены в проверенном release-with-report.bundle (SHA256 278926e78001b55d3d649ba2a81bfde665f8d5d34a1fad1766a8a1a1e27528d3) на VPS и вне VPS. Текущий документ дополнен после публикации; runtime-код и образ не изменялись. Перед публикацией проверены добавляемые файлы на известные секреты и приватные архивы; ограниченный scan не заменяет полный security audit.

## Production проверки и мониторинг

- /api/health: 200, status ok; app healthy, restart count 0 на проверках после deploy.
- /, /rehabilitation, /psychology, /shop, /shop/cart, /account, /login: HTTP 200.
- /admin и /admin/bookings без cookie: 307 на вход, не ошибочный публичный доступ.
- /api/payment/status без токена: 403; GET /api/payment/init: 405; /api/admin/payment-links без cookie: 401. Это отрицательные проверки маршрутов, не подтверждение реального списания.
- Nginx config test PASS. В начальном окне наблюдения после переключения ошибок Nginx и совпадений Error/failed/Exception в app log не найдено.
- Реальных bank callbacks в проверенном окне access log не наблюдалось; обработка callback/retry проверена offline integration tests, не живой банковской транзакцией.
- PostgreSQL и Redis остались healthy с прежним временем запуска 2026-10-09T12:24:14Z. Миграций по-прежнему 20.

Диск: до работ около 2,1 ГБ свободно; после сборок доходил до 742 МБ. Удалён только неиспользуемый build cache (1,584 ГБ и затем 1,393 ГБ по Docker). Рабочие/rollback образы, volumes, backups и данные не удалялись. После очистки около 2,0 ГБ свободно (92% занято); это остаётся операционным риском для следующих сборок.

## Откат без изменения данных

На VPS:

```sh
cd /opt/doctor-site
docker compose --env-file .env.production -f docker-compose.prod.yml -f deploy/stage06-rollback.yml up -d --no-deps --no-build app
docker inspect doctor-site-app-1 --format '{{.Image}} {{.State.Health.Status}}'
curl -fsS https://body-state.ru/api/health
```

Override закрепляет предыдущий image ID и исключает запуск миграций даже у старого образа. Не использовать down -v, не восстанавливать старый dump поверх живой БД для этого UI-релиза. При откате сохранять override во всех следующих командах до выбора исправленного релиза: обычный Compose без override снова выберет закреплённый новый APP_VERSION.

Rollback image существует и конфигурация подготовлена; фактическое переключение назад не выполнялось, поскольку критической регрессии не обнаружено.

## Незакрытые пункты

1. Авторизованная browser-приёмка production-админки и клиентского кабинета. Нужен обычный пользовательский вход; production-пароли не сбрасывать.
2. Ветка опубликована; ручной GitHub CI ещё не запускался. Для будущего прямого push с VPS нужен отдельный ограниченный доступ; секреты не публиковать и не пересылать в чат.
3. Реальные устройства: DEVICE QA NOT VERIFIED.
4. Отдельное обновление dev dependencies; общий npm audit пока не чистый.
5. Ограниченный свободный диск, дальнейшая политика хранения образов/ёмкость VPS.
6. Живая SMTP-доставка, реальные платежи/возвраты и полный финансовый этап вне проверки этого выпуска.

**Итог: релиз установлен и базово стабилен; Stage 0.6 PARTIAL из-за перечисленных незакрытых приёмочных пунктов.**
