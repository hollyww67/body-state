# Body State UI 2.0 — scoped visual acceptance

## Target and evidence

Scope: первая очередь административной UI migration, не буквальный перенос демонстрационного SaaS и не полная приёмка всех страниц.

Source visual truth: пять изображений владельца в `C:/Users/user/Downloads/`: `Дизайн-система Body State_ библиотека UI компонентов.png`, `Дизайн-система Body State 2.0.png`, `Панель управления Body State.png`, `Панель календаря записей BODY STATE.png`, `Интерфейс BODY STATE_ клиника и записи.png`. Пять текстовых ТЗ идентичны по SHA256 `8a4397a16e129d592c9d18637f5f17dbb106be21859c7916f543134c69d4dd64`.

Implementation: `http://localhost:3909/admin/dashboard` и `/admin/calendar`, отдельные synthetic PostgreSQL/Redis, production Webpack standalone app. Реальных клиентов/отправок/платежей нет.

CSS viewports1440×900 /768×1024 /390×844, light default и существующая violet. Проверено через DOM innerWidth/innerHeight, overflow=false. Browser JPEG capture может исключать scrollbar/масштабировать изображение: desktop1425×891 при CSS1440×900; это не объявляется физическим device acceptance или zoom. При сравнении desktop обе стороны нормализованы по ширине720px, source1536×1024→720×480, implementation1425×891→720×450. Без растягивания до одинаковой высоты. Full-view sheets: `docs/design/screenshots/dashboard-comparison.jpg`, `calendar-comparison.jpg` (source слева, implementation справа), открыты и рассмотрены вместе. Focused card sheet: `stat-card-comparison.jpg`, сравнение реальных padding/icon/text/состояний, а не только маленьких full-view thumbnails.

Основные captures: desktop-dashboard.jpg, desktop-calendar.jpg, desktop-loading.jpg, mobile-dashboard.jpg, mobile-calendar.jpg, mobile-form.jpg, mobile-navigation.jpg, tablet-calendar.jpg, tablet-form.jpg, violet-calendar.jpg в `docs/design/screenshots/`. Диалог проверялся отдельно на mobile и tablet; source calendar показывает desktop creation panel, поэтому сравнение его композиции с mobile не выдаётся за pixel-perfect.

## Findings / iteration history

1. [P2 FIXED] Search icon перекрывал placeholder: padding общего input побеждал utility. Добавлен scoped `.bs-input.pl-10`; повторный desktop/tablet capture показывает раздельные иконку/текст.
2. [P2 FIXED] Недельная сетка зажата sidebar, часть дней вне видимости. Full-width week/day, минимальная ширина колонки128, detail ниже сетки. Финальный DOM desktop: timeline clientWidth=scrollWidth1078, все семь дней видимы, page overflow=false. Геометрия времени/конфликтов не переписана.
3. [P2 FIXED] Actions карточки могли выходить за границу узкой колонки. Добавлены wrap и компактный time marker. Контрольные формы/детали доступны без page overflow.
4. [P2 FIXED] Broken logo и ошибочный PWA notice оказались QA packaging ошибкой public/public в повторном builder. Исправлен isolated Dockerfile, logo использует стабильный локальный asset, финальные assets доступны. Production не затрагивался.
5. [P2 FIXED, independent Grisha review] Violet primary white2.20:1. `--bs-on-primary` применён к существующим primary actions. Финальный browser computed style у «Сегодня»: foreground rgb22,17,32 /background185,160,255. Новый contrast test сам по себе проверяет light tokens, поэтому dark fix дополнительно подтверждён браузером.
6. [P2 FIXED, independent Grisha review] Mobile CSS grid-row sidebar против DOM. Убрана перестановка; финальный computed gridRowStart=auto.
7. [P2 FIXED] Mobile dashboard metrics занимали четыре длинных строки. Две колонки; финальный DOM:169.6px169.6px, overflow=false; повторный mobile-dashboard capture после layout settle.
8. [P2 FIXED] Повторный calendar header занимал лишнюю высоту. Убран дублирующий title/description (общий h1 остаётся), stats сделаны компактными. Финальный desktop-calendar capture.

## Required fidelity surfaces

- Typography: существующий self-hosted Manrope через next/font, кириллица; browser computed font family подтверждён. Unified scale tokens; длинные реальные названия услуг не заменены короткими демонстрационными.
- Spacing/layout:4px scale, controls8/card12/overlay16, спокойные surfaces и мягкие тени. Desktop основной столбец+actions, mobile two-column metrics и существующая нижняя навигация. Day/week overflow остаётся внутри timeline на маленьких экранах, не страницы.
- Colors: neutral/light + Body State teal, semantic badges и visible focus; сохранён violet override. Шесть основных light text pairs5.32–5.94:1; не заявляется соответствие WCAG всех legacy классов.
- Assets: настоящий брендовый `/admin-icons/192.png`; вымышленный лист/фотографии врачей/декоративное растение не копируются. Initials там, где нет реальных аватаров, сохраняют существующее поведение и не выдают вымышленные портреты за клиентов.
- Copy/content: реальные all-time показатели подписаны как all-time, нет фиктивных процентов роста/фамилии администратора/специалистов/кабинетов/клиентских мессенджер-кнопок.

## Intentional product constraints vs source

Reference — visual direction, не specification новых backend features. Существующие groups/search/help/auth/theme/logout остаются вместо декоративного global search и неработающих bell controls. AdminToday сохраняет реальные payment/notification tasks вместо недостоверного графика и сокращённого демонстрационного календаря. Минимальные touch intervals и длительности90мин сохраняются: весь рабочий день не сжимается в маленький экран как в иллюстрации. Воскресное расширение/перенос/закрытые дни и параметры backend не меняются. Это осознанные отклонения, не заявление pixel-perfect clone.

## Interaction evidence

Штатный login synthetic admin; sidebar navigation/search присутствует; month/week/day переключаются; light/violet переключаются; create modal открывается; disabled submit при отсутствии согласия; Tab name→phone; Escape закрывает dialog и возвращает фокус на «Запись»; mobile menu открывается и Escape закрывает; desktop/tablet/mobile overflow=false; console error entries=[] при финальной проверке. Loading и empty состояния dashboard наблюдались. Errors/busy/repeated-click проверены offline component contracts, не объявляются всеми browser visual states. Реальных mutation/payment/provider calls в production не было.

## Residual QA / polish

P3: дальнейшее сокращение legacy utility overrides и унификация domain service markers в следующих страницах. Вторая очередь и полный UI catalogue перечислены отдельно в MIGRATION_V2.md/UI_KIT_V2.md, не включены в этот pass. Actual zoom200%, physical installed iOS/Android PWA, screen readers и автоматизированный axe — MANUAL PENDING/NOT RUN. Нет exact-HEAD hosted CI или production deployment в рамках этой задачи.

Implementation checklist: scoped foundation ✓; first-wave integrations ✓; offline tests ✓; production build ✓; same-source runtime check ✓; browser captures/comparison ✓; production unchanged ✓.

final result: passed
