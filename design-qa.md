# Stage 3.1 design QA — current acceptance

17.10.2026, Петрович. Ниже перед архивом Stage3 приведён актуальный результат Stage3.1.

## Visual truth and evidence

Source: `C:/Users/user/Downloads/Панель управления Body State.png`, `Панель календаря записей BODY STATE.png`, `Интерфейс BODY STATE_ клиника и записи.png`, каждый1536×1024. Implementation: production-built isolated `http://localhost:3921`, synthetic data, no providers.

`docs/design/screenshots-stage3-1/compare-dashboard.png`, `compare-calendar.png`, `compare-calendar-form.png`, `compare-mobile-dashboard.png`, `compare-mobile-calendar.png`, `compare-mobile-booking.png`: source-left + implementation-right в одном изображении; все пары просмотрены. Mobile пары390px также служат focused evidence читаемых вкладок/карточек/действий, отдельное увеличение не требуется.

CSS viewports320×740,390×844,768×1024,1440×900,1920×1080. IAB density: обычная mobile PNG375×811 при CSS390×844; native modal390×843; desktop full-page width1424/variable document height, modal1440×900. Mobile reference crop x49/553/1058,y78,432×900, без hardware/statusbar →390×812. Desktop top crop1440×900. Это нормализованное сравнение композиции, не pixel-distance score; данные/имена/даты/длительности различаются.

## Iteration / findings

P2 initial: search/filter/mode chrome вытеснял дату и приёмы с первого экрана. `calendar-390-qa1.png` сохранён. Исправлено явным mobile disclosure; режимы/фильтры не удалены. Пересборка, повторные320/390, новый `calendar-390.png`, повторное сравнение `compare-mobile-calendar.png` подтвердили исправление.

Неверный/stale route capture обнаружен при просмотре evidence: Dashboard переснят в отдельной фоновой вкладке с проверкой URL/heading. Имя файла само по себе не принималось за доказательство.

## Fidelity surfaces

- Typography: существующий Manrope, ясная иерархия и перенос длинных настоящих названий услуг.
- Spacing/layout: full-screen booking, отдельный scroll/action bar, right creation panel, day/week strip, KPI/actions/visits/orders. Нет measured page overflow; week grid имеет свою прокрутку.
- Colors: существующие нейтральные/teal/semantic tokens, без новой темы или библиотеки.
- Assets: существующий логотип и icon library; инициалы реальных synthetic identities вместо вымышленных фотографий, как требует no-fake-data scope.
- Copy/content: честные payment/notes empty states, никаких ложных чеков/доставки; перенос/отмена/attendance сохраняют смысл.

## Interactions and limits

Browser: настоящие четыре вкладки/history, keyboard End/arrows, вход в перенос, disabled submit без согласия в календаре, tools/month/day, Dashboard→create, native focus, Shift+Tab wrap, Escape/restore, body lock/cleanup. Console error/warning inspection пусто. Synthetic PostgreSQL regressions:21 V2 +9 pool groups. Browser POST mutation не выполнялся; это не объявляется полным browser-to-DB E2E.

Не выявлено оставшихся actionable P0/P1/P2 visual findings в согласованных domain/data границах. P3: дальнейшая desktop-плотность/старые history labels после owner review. Специалисты/кабинеты/payment detail/notes editing/duplicate — отдельные domain proposals, не fake controls.

Actual zoom200 и physical iOS/Android PWA — MANUAL PENDING. Owner approval и production release — отдельные gates.

final result: passed

---

# Archived Stage3 design QA (superseded above)

Ответственный — Петрович. Source: `C:/Users/user/Downloads/Панель управления Body State.png`, `C:/Users/user/Downloads/Панель календаря записей BODY STATE.png`, `C:/Users/user/Downloads/Интерфейс BODY STATE_ клиника и записи.png`. Implementation: isolated http://localhost:3920, synthetic-only data, real App/PG/Redis, providers OFF.

## Evidence

`docs/design/screenshots-stage3/compare-dashboard.png`, `compare-calendar.png`, `compare-mobile-dashboard.png`, `compare-mobile-calendar.png`, `compare-mobile-booking.png`, `compare-dashboard-focus.png` открыты как единые сравнения reference-left / implementation-right. Focus sheet нужен для читаемой проверки typography и KPI.

Запрошенные CSS viewports: 1440×900, 1920×1080, 768×1024, 390×844, 320×740. IAB PNG capture не всегда равен CSS size: например mobile 375×811 при CSS390×844, details390×843; desktop1424×1220 full-page при CSS1440×900. Поэтому reference и implementation нормализованы по ширине, без заявлений о 1:1 density/pixel parity. Mobile source1536×1024: app-region crop432×900, затем390px, верх780px; hardware/status bar исключены. Navigation проверена отдельно, а не подогнана изображением.

## Iteration history

1. Initial mobile 4-column KPI — P2 unreadable density. Переведено в читаемую сетку; первый browser iteration выявил старое правило full-width action, исправлено.
2. Side-by-side comparison выявил P2: две KPI/actions строки отодвигают визиты, а Calendar показывает повторную бренд-шапку. Исправлено: три приоритетных KPI, один ряд actions, компактный date toolbar, без лишней высоты welcome; повторная шапка календаря скрыта, views/filters доступны. Post-fix `compare-mobile-dashboard.png` и `compare-mobile-calendar.png` повторно открыты вместе с источником. Визиты доступны на первом экране; более высокая дневная карточка отражает настоящие 90 минут, а не 60 минут mockup.
3. Независимые offline P2 (empty date throw, unnamed search, agenda contrast) исправлены и проверены Гришей. Browser layering P1 (utility behind mobile bar) исправлен, меню/поиск/Escape реально работают.

## Required fidelity surfaces

- Typography: действующий Manrope и общий hierarchy; маленькие dense timeline captions не подменяют полную карточку.
- Spacing/layout: grid/rail, светлые карточки и устойчивые интервалы; mobile density повторно проверена по post-fix сравнению, приёмы доступны в первом экране.
- Colors: semantic mint foundation, AA pairs offline PASS, альтернативная violet без нового бренда.
- Assets: настоящий логотип, существующие icons, инициалы вместо вымышленных фотографий. Нет растрового UI или CSS-рисунков вместо assets.
- Content: настоящие источники данных, без growth percentages, fake specialists, fake financial series и несуществующих операций.

## Итог сравнения и intentional deviations

Desktop сохраняет sidebar/topbar/grid/rail; основная сводка не содержит вымышленных временных рядов и процентов роста. Отдельный день и его задачи занимают место, потому что это реальный инструмент, а не статичный mockup. В недельной сетке сохранена прежняя геометрия и локальный horizontal scroll на недостаточной ширине — page overflow не возникает. Calendar form отдельно сравнен в `compare-calendar-form.png`: используется прежний центрированный native modal, а не новый drawer. Неподдерживаемые вкладки, specialists и комментарии не дорисованы. Карточка клиента остаётся modal с identity/consent, а не фиктивной отдельной страницей.

После итераций не осталось обнаруженных P0/P1/P2 в проверенных состояниях. Это визуальная готовность к **owner review**, не утверждение о pixel parity или сертификации accessibility. Маленькие dense grid captions, дополнительная общая кнопка закрытия и дальнейшая визуальная полировка modal — P3 follow-up, не скрытые функциональные обещания.

## Remaining checks

Physical PWA/actual zoom200 остаются ручными. Browser route smoke не заменяет тест каждого изменяющего действия. Viewport не выдаётся за installed-device acceptance. Проверены реальные menu/search, drawer Escape/scroll restoration, native modal open/close и guard-пропсы; console ошибок в финальном smoke не обнаружено. Общий logout API сознательно не изменялся.

final result: passed
