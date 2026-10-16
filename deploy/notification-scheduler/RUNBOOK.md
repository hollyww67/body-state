# PR4 notifications-v1 — предложение, не установленный scheduler

Ответственный: Сеня (guard/QA); Main — route/SQL; Макар — SMTP.
Основа: фактический ../cron-guards-v1/guard.py, SHA256
893d110c8ad5e75a51c17aa658fd2d81a65f671a4ba83025445198090334a01c.
Прототип cron-guards-v2 не использован. Legacy-файлы не меняются.

## Контракт и границы

Отдельный system entry: notifications-v1.cron (UTC epoch minute, каждая минута).
system.front.sh сохраняет minute до запуска Python; admission без ожидания,
requested minute должна совпасть с текущей. POST только на
http://127.0.0.1:3000/api/cron/notifications-v1, Authorization Bearer из защищённого
config, x-notification-source=system, x-notification-minute=epochminute.
Порт 3000 обязан быть локальным опубликованным портом приложения на этом хосте.
Нельзя активировать до проверки фактической сети/reverse proxy и доступа.
Redirect/proxy/retry запрещены. HTTP200 принят только с JSON state
done/duplicate/disabled; disabled не доказывает отправку. Другие ответы и
обрыв — uncertain. Тело ограничено 4096 байт, не попадает в audit.

Deadline: min(конец исходной UTC-минуты, admission+50 секунд). Worker имеет
реальный Linux SIGALRM, сохраняет task FD при гибели guard; admission FD
не наследуется. Это ограничивает клиент, но не доказывает остановку работы
приложения/SMTP/БД. DB active_run остаётся независимым барьером без timed retry.
Часы хоста/БД должны быть синхронизированы; rollback времени блокируется ledger.
Пропущенные минуты не воспроизводятся, даже после resume.
root-source всегда disabled; нет команды включения root.

## Подготовка и установка — только после отдельного разрешения

Никакой production/SSH/deploy в PR4 QA не выполнялся.
До установки выяснить действующие среды, владельцев, сеть, cron sources,
запуск/откат, зависимости Python3/Linux flock/proc и durable fsync.
Проверить root:root, отсутствие symlink, ACL, writable ancestors.
Код и front: root0700 в /usr/local/libexec/doctor-site-notifications-v1/guard.py
и /usr/local/sbin/doctor-site-notifications-v1 соответственно. State:
/var/lib/doctor-site-notifications-v1 root0700 на durable FS, не /run.
Config: /etc/doctor-site/notifications-v1.json root0600 с ключом cron_secret,
который оператор предоставляет из существующего CRON_SECRET по отдельно
согласованной процедуре; значения никогда не выводить. Секреты этим PR не меняются.
Lock/ledger/audit: root0600. Код/front устанавливать LF, проверить SHA/mode.

Обязательный operator code-integrity gate перед публикацией и каждым resume:
проверить canonical path, root:root, regular file, mode0700, отсутствие ACL и
writable ancestors у guard/front; SHA256 сверить с отдельно сохранённым
reviewed release manifest, который также root-controlled. Снять dev/inode
при staged verify и сверить опубликованный inode с проверенным staged inode
после atomic replace. При несовпадении или изменении source оставить оба pause.
Не обновлять код по месту при активном worker. Guard не проверяет собственный
SHA автоматически: это внешний обязательный publication/resume gate, а не
защита от root-компрометации. В cron QA проверяются SHA, ownership/mode/path и
неизменность dev/inode/hash к концу наблюдения; manifest генерируется из образа,
поэтому этот тест проверяет стабильность артефактов, не доверенность релиза.

1. Зафиксировать текущие SHA/metadata и план отката; staged publication через
   O_EXCL/O_NOFOLLOW, fsync и atomic replace. Existing state не перетирать.
2. До публикации cron вызвать guard pause; отдельно проверить paused.json и
   status. Существующий legacy pause этому guard не подчиняется.
3. Сохранить действующий legacy integration pause runbook:
   ../cron-guards-v1/INSTALL-ROLLBACK.md, включая system-first publication,
   drain старых wrapper/curl (240 секунд +60 grace), независимую сверку
   app/provider/DB, root disabled и отсутствие catchup. Сохранённые original
   не вызывать напрямую. Этот PR не меняет legacy расписания или front.
4. Legacy daily route продолжает dispatch своей legacy queue по ежедневному
   расписанию. Внутри daily route прекращается только обработка V1 queue:
   Main должен подтвердить эту границу перед включением минутного V1 worker.
   До подтверждения новый guard и DB остаются paused, scheduler env false.
5. DB022 изначально paused=true; NOTIFICATIONS_V1_SCHEDULER_ENABLED=false
   по умолчанию. Установку SQL/изменение env выполняет Main только по разрешению.
   Паузы БД и guard управляются независимо.
6. При согласованном cutover: оба pause; дождаться guard lock drain и отдельно
   проверить отсутствие незавершённого DB active_run/SMTP, сверить legacy drain.
   Затем отдельным разрешённым действием Main снимает DB pause и включает env.
   Последним снимается guard pause. Проверить status и durable marker даже
   при ненулевом выходе resume: audit может отказать после удаления marker.
   Никаких ручных endpoint smoke sends — наблюдать следующую естественную минуту.

Управление установленным кодом: /usr/bin/python3
/usr/local/libexec/doctor-site-notifications-v1/guard.py
с аргументом pause, status или resume. Для остановки сначала guard pause,
затем Main ставит DB paused=true и сверяет active_run. При disconnect marker
сохраняется; новый процесс/рестарт никогда не снимает его автоматически.
Pause drain максимум55 секунд; timeout не означает завершение server work.

## Recovery / rollback

Коды: 0 завершено, 75 deferred/busy/disabled/uncertain, 78 unsafe/error, 2 input.
После crash ledger running блокирует все следующие минуты. Не удалять state,
не менять lock inode, не чистить active_run по таймеру. Оба pause, сверка
реального результата app/DB/provider. Только после явного разрешения оператор
вызывает acknowledge-uncertain notifications-v1 при guard pause; Main отдельно
согласует DB reconciliation. Acknowledge сохраняет minute и не разрешает replay.
Не обещать exactly-once provider delivery: guard не заменяет DB/provider idempotency.

Откат: оставить оба pause, отключить только новый отдельный cron entry после
разрешения; сохранить ledger/locks/audit/config. Legacy восстановление — строго
по сохранённому v1 runbook после reconciliation. Не возвращать legacy dispatcher
при живом новом active_run. Нет миграции вниз, удаления данных или auto-resume.
Audit retention согласуется отдельно; lock/ledger не ротировать.

## Воспроизводимый QA и фактические результаты

Из корня source (PowerShell), использован только Docker context default:

    docker --context default run -d --name notification-scheduler-pr4-qa --network none --mount type=bind,source=C:/Users/user/projects/123/doctor-site/.scheduling-v2/source,target=/input,readonly python:3.12.14-slim-trixie sleep infinity
    docker --context default exec notification-scheduler-pr4-qa python /input/tests/notification-scheduler-guard.py
    docker --context default restart notification-scheduler-pr4-qa
    docker --context default exec notification-scheduler-pr4-qa python /input/tests/notification-scheduler-guard-restart.py

Выполнено: 25 PASS + отдельный PASS реального stop/start того же контейнера.
Linux subprocess/flock/SIGKILL/orphan FD, overlap8, duplicate, durable pause,
operator disconnect, failed HTTP409/503, invalid200 body, разрешённые state,
hard alarm и expired worker без HTTP. Сервер только loopback, fake provider,
изолированная SQLite, production credentials отсутствуют, sends=0.
Нет проверки реального PostgreSQL route, SMTP, VPS/kernel reboot или live cron.
Это ограничение интеграции; результаты Main/Макара нужны отдельно.
QA container сохранён остановленным для evidence, state только в его writable layer.

## Real cron QA (дополнение userB)

CI/Linux из корня source: sh deploy/notification-scheduler/run-cron-qa.sh.
Windows: powershell -File deploy/notification-scheduler/run-cron-qa.ps1.
Оба runner выполняют Docker build/run через context default и возвращают
ненулевой код при ошибке. Образ Dockerfile.cron-qa содержит Debian cron;
COPY устанавливает фактические notifications-v1.cron, system.front.sh и guard
без подмены расписания/front/часов. /usr/bin/python3 указывает на Python образа.
Build требует Debian repository; runtime --network none, без mounts/ports,
секрет только синтетический, fake HTTP только loopback.

tests/notification-scheduler-cron.py запускает cron -f, наблюдает две соседние
естественные минуты (максимум130 секунд), сверяет реальные epochminute/header,
две успешные ledger finalization и отсутствие вызова daily route.
Старый ledger на пять минут раньше не вызывает catchup; отдельно проверяется
stale-key admission без HTTP. Пауза и остановка daemon завершают тест.
Evidence /qa/evidence/result.json и cron.log сохраняются в завершённом контейнере.
Команды запуска не содержат ручного dispatch для двух cadence occurrences.
Это проверка system cron model; production userB/его ОС не подключались.
Real PostgreSQL core и SMTP остаются отдельными проверками Main/Макара.

Фактический локальный запуск 2026-10-15: container
notification-scheduler-cron-pr4-natural, exit0, PASS, 92.878 секунд.
Естественные POST: 17:58:02.158042 UTC minute29868118 и
17:59:01.276255 UTC minute29868119. Две соседние минуты, daily_calls=0,
catchup_calls=0, sends=0; SHA/root metadata/inode gate PASS.
Запущены docker build -f deploy/notification-scheduler/Dockerfile.cron-qa
-t notification-scheduler-cron-qa:local . и docker run -d
--name notification-scheduler-cron-pr4-natural --network none
notification-scheduler-cron-qa:local (везде --context default).
PowerShell runner отдельно прошёл синтаксический parser check.
