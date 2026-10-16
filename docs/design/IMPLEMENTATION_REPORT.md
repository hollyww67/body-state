# Body State UI 2.0 — первая очередь

Дата: 16.10.2026. Петрович — интеграция/токены/календарь/браузер; Петя — dashboard/Timeline; Гриша — компонентные тесты и независимое ревью.

## Реализовано

Отдельная `feat/admin-design-system-v2` от работающего `5d3146fc6402c50adb4ada24a255944ab577e7d7`. Новая MAX V2 ветка не смешана с UI. Семантические scoped токены, Manrope, 4px spacing, радиусы/тени/motion, сохранённая violet-тема. Admin UI primitives, обновлённые dashboard/layout/sidebar/calendar/form/timeline/status badge. Миграция первой очереди, не всех административных страниц. Таблица границ в MIGRATION_V2.md.

Аутентификация в server layout неизменна. Контракты props native elements сохраняются, интервалам/дате/выбору слотов и mutation handlers не добавлены новые правила. AST-сравнение pre-return statements calendar/dashboard/Timeline с base SHA PASS: вычисления и handlers идентичны. `git diff` по src/app/api, src/lib, migrations и public globals пуст.

Локальная QA-сборка обнаружила неправильное копирование public в повторно используемый builder: получался public/public. Исправлен только Dockerfile.SchedulingQA: mkdir + copy contents, не production Dockerfile. Никакого изменения рабочего production image или его filesystem не выполнялось.

## Проверки

- TypeScript noEmit и ESLint изменённых административных областей — PASS.
- `node tests/admin-design-system.cjs` — 10 offline regression groups PASS (props/ref/loading, labels/errors, badges, scope, focus/reduced-motion, palette contrast, DOM order).
- `node tests/admin-modal.cjs` — PASS: duplicate/busy/success/error/cancel events.
- `node tests/admin-pwa.cjs` — PASS static lifecycle/network-only/offline contracts; не physical-device acceptance.
- `node tests/payment-init.cjs` — PASS mocked ok/reject/timeout/malformed outcomes, без реального банка.
- `node tests/dependency-regressions.cjs` — PASS offline provider/email/image/QR/source-map groups.
- Production Webpack Docker build — PASS; QA artifact, не разрешённый production release.
- Итоговый локальный QA image `body-state-admin-design-v2:handoff`, manifest-list digest `sha256:ffc2869b00fb9cc5742b4f70373808bd2df20ac06156e913d451f03338c1b94f`. Все восемь изменённых runtime файлов сопоставлены с содержимым image; docs/tests добавлены отдельно. Это не заявление о GitHub CI/provenance production artifact.
- Применение миграций только к новой synthetic DB `scheduling_v2_browser` — PASS; пять искусственных клиентов `example.invalid`, без provider credentials и внешней сети приложения.
- Browser evidence и окончательный visual gate — см. project-root design-qa.md. Код и HTTP health сами по себе не считаются visual acceptance.

Контраст основных light text pairs: primary5.32, muted5.34, success5.57, warning5.94, destructive5.39, info5.88. Это не сертификация всех legacy цветов.

## Review / исправления

Гриша нашёл два P2: violet primary белый foreground (2.20:1) и CSS-перенос sidebar перед DOM-предшественниками на mobile. Использован semantic on-primary, visual reorder убран; оба защищены отдельными regression groups. Browser QA дополнительно выявил наложение search icon, клиппинг календаря/действий и слишком высокий повторный header. Исправлены padding, ширина недельной области, wrap действий и компактная сводка. Логотип настоящий, не лист из иллюстративного референса.

## Ограничения

Не завершены вторая очередь страниц и весь необязательный UI catalogue. Интеграционные DB scheduling suites47/9/21 в этом UI-проходе не запускались; это не новый backend release. Не проверены physical PWA iOS/Android, реальный zoom200%, screen reader, все browser/mail clients и полный автоматизированный axe audit. Hover/error/loading всех legacy экранов не объявляются визуально проверенными.

## Production / handoff

Production не изменялся: ни SSH deployment, ни ENV, ни schema/cron/Nginx, ни MAX/Email/pairing, ни payments. Синтетические QA контейнеры локальные. Перед любым live release требуется отдельный owner GO и обычный release preflight. До него — оценка localhost:3909 и дальнейшая поэтапная миграция второй очереди.
