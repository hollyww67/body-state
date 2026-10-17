# Stage 3: независимый bounded offline QA

Ответственный: Гриша. Дата: 2026-10-17.
Ветка: `feat/admin-premium-healthcare-v3`.
Фиксированная база: `d1c276602306ee8c6ab174c6269155fb08f435c0`.

## Результат

**VERIFIED** — окончательный offline `node tests/admin-healthcare-v3.cjs`: **81 VERIFIED / 0 BLOCKED**, exit 0. `node --check` также прошёл.
Четыре причины предыдущих блокировок устранены в исходниках Петровичем и повторно проверены Гришей. Ниже сохранены исходные доказательства с актуальными результатами перепроверки.
Это offline-проверка текущего рабочего дерева, а не окончательная браузерная приёмка параллельно редактируемой реализации.

**VERIFIED** — исходные 10 групп `tests/admin-design-system.cjs` выполнены дочерним процессом и прошли. Файл не изменён.
**NOT TESTED** — Phase 2/«213 guards»: старый тест не запускался и PASS ему не присваивается. Его старая база и требование неизменности Phase 1 не подходят для полной приёмки v3.

## Перепроверка прежних замечаний

### 1. Очистка даты вызывает исключение при форматировании — P2

**VERIFIED — исправлено; изолированное выполнение фактического helper**.
Файл: `src/components/admin/AdminToday.tsx`, новая дата над agenda.

В прежнем снимке выражение `Intl.DateTimeFormat(...).format(new Date(day+'T12:00:00+03:00'))` выбрасывало `RangeError: Invalid time value` при `day === ''`.
Теперь JSX вызывает `calendarDayLabel(day)`. Тест извлекает целиком фактическую функцию из AST и исполняет её в VM: `2026-10-17` → «17 октября», `2024-02-29` → «29 февраля», пустая строка, `invalid` и `2026-13-17` → «Выберите дату», без исключений. Проверено единственное подключение helper к JSX с аргументом `day`.

Воспроизведение в продукте для основной браузерной проверки: дождаться загруженной сводки, очистить native date input. `onChange` сохраняет пустую строку; до выполнения эффекта загрузки остаются прежние `data` и `loading=false`, поэтому новая дата вычисляется во время render.
Guard некорректной даты добавлен Петровичем; точные logic/expression delta просмотрены заново. Прежние state/effect/fetch/handlers остались baseline-exact.
**NOT TESTED** — полный React-переход после очистки даты с уже загруженными данными в браузере.

### 2. У мобильного поиска пропадает доступное имя — P2

**VERIFIED — исправлено; статический JSX/CSS-контракт**.
Файлы: `src/app/admin/AdminTopbar.tsx`, `src/app/admin/healthcare-shell.css`.

Кнопка `.healthcare-section-search` содержит декоративный SVG с `aria-hidden="true"` и текстовый `span`. При ширине <=640px stylesheet задаёт этому `span` `display:none`. В текущем исходнике есть постоянный `aria-label="Найти раздел или действие"`; тест проверяет его точное непустое значение.
Воспроизведение: мобильная ширина <=640px, пройти Tab до поиска и проверить accessible name.
Прежнее замечание описывало прочитанный тогда снимок исходника. По уточнению Петровича исправление было внесено до публикации предыдущего отчёта, а dev hot reload отставал. Сейчас замечание закрыто по исходнику; временной порядок правки и hot reload независимо не устанавливался, старый кадр не используется как доказательство текущей ошибки.
**NOT TESTED** — фактическое accessibility tree и чтение экранным диктором.

### 3. Мелкий текст agenda ниже AA — P2

**VERIFIED — исправлено; расчёт по явным CSS-токенам**.
Файлы: `src/app/admin/design-system.css`, `src/app/admin/healthcare-dashboard.css`.

В прежнем снимке `time` имел 11px и `--bs-muted: #60717d` на `--bs-primary-soft: #e2f3ec`: **4.395:1** при требуемых **4.5:1**.
Теперь `time` — 12px, `--bs-foreground: #17212f`; вторичный `small` использует обновлённый `--bs-muted: #586974`. Тест проверяет оба реальных foreground на всех трёх фоновых токенах новой agenda:

| Foreground | primary-soft | warning-bg | destructive-bg |
| --- | --- | --- | --- |
| foreground | 14.104:1 | 14.939:1 | 14.225:1 |
| muted | 4.953:1 | 5.246:1 | 4.995:1 |
Воспроизведение: agenda выбранного дня с обычной, например confirmed, записью; сравнить цвет времени и фон карточки.
Все пары проходят AA. **NOT TESTED** — computed styles/скриншот после полного CSS cascade. Проверка семантических пар default/violet также проходит; таблица выше относится к default palette.

### 4. Начальный режим календаря изменяет исходный диапазон API — отклонение scope

**VERIFIED — исправлено; diff и AST**.
Файл: `src/app/admin/calendar/page.tsx:44`, связанные `rangeStart`, `rangeEnd` и `fetchCalendar`.

Прежнее изменение initializer с `'month'` на `'week'` меняло диапазон `rangeStart/rangeEnd` и исходный `/api/admin/calendar?from=...&to=...`. Теперь initializer восстановлен в `'month'`; AST non-JSX logic календаря полностью совпадает с базой. Обе ранее блокировавшие проверки проходят без исключений для initial view.
Воспроизведение: открыть календарь без `?date=`; сравнить исходный режим и диапазон с базой.
Guard не ослаблен и hash исключения для начального режима не добавлен.
**NOT TESTED** — фактический сетевой запрос в браузере.

## Что закреплено тестом

**VERIFIED** — deny-by-default граница tracked/untracked runtime-файлов относительно fixed base. Backend/API/lib/auth, migrations, зависимости, public, production/config файлы не получили исключений. Git сравнивает repository content с учётом нормализации EOL, а не буквальные CRLF-байты рабочего файла. Документы и тесты исключены из runtime-границы.

**VERIFIED** — точные requests/payload AST и inline styles относительно базы, включая `box(a,z)` и геометрию timeline. Отдельный обход variable declarations заходит внутрь JSX callbacks и защищает `a/z`, интервалы, conflict, scale/height/column; общее стирание JSX само по себе этого не обеспечило бы. Calendar baseline initializer и все пять проверяемых файлов проходят независимые проверки исходных вычислений.

**VERIFIED** — существующие JSX-обработчики: Sidebar, AdminToday, bookings, dashboard и timeline совпадают с базой. У Topbar разрешён только точный новый search dispatch; у calendar — точная просмотренная перестройка service filter/select, direction buttons, date strip и new-booking shortcut. Существующие mutation handlers и payload не получили исключений.

**VERIFIED** — imports и AST presentation-изменения разрешены SHA-256 точного multiset-delta (removed/added), отдельно по файлу и виду контракта. Это не автоматическое обновление baseline и не разрешение произвольных вычислений. Любая следующая отличающаяся правка создаёт новый delta и требует просмотра. `--review-deltas` только печатает кандидаты, не сохраняет и не утверждает их.

Просмотренные точечные изменения:

- Sidebar: точная подписка/cleanup `admin-navigation-search`, раскрытие/focus поиска, mobile labels, ссылка профиля.
- Topbar: иконки, search event, уведомления/help, дата по Москве, перенос heading; повторно просмотрен точный delta с исправленным aria-label, native user menu и дополнительным поиском с тем же event dispatch.
- Layout: ровно три новых локальных CSS imports; остальной AST, включая auth, baseline-exact.
- Dashboard: MiniCalendar import, группировка блоков, удаление дублирующего списка последних записей, перенос прежнего revenue output. Requests, stats и загрузка сохранены.
- AdminToday: `serviceLabel`, `appointmentTime`, инициалы, read-only agenda, task disclosure/count, составные keys, замена input/button на существующие DS primitives; повторно просмотрены точные helper `calendarDayLabel` и его вызов.
- Timeline: импорт BookingStatusBadge, `data-service`, показ конечного времени через существующий `z`, статус и conflict output. Расчёты времени не меняются.
- Calendar: presentation JSX/filter/date-strip/counters, `data-service`, классы форм. Initial view сохранён; повторно просмотрено добавление только мобильного daily timeline.
- MiniCalendar: полный AST нового компонента закреплён отдельно; это локальная справка по месяцу, без API/доступности appointment slots.

**VERIFIED** — namespacing всех новых healthcare CSS, запрет новых global imports/token overrides/ресурсов в этих файлах, imports healthcare CSS только из admin layout. Старые regressions проверяют native props/ref/handlers, default button type, disabled/loading, описания/labels, focus и reduced motion. Новый helper времени отдельно проверен на missing/invalid timestamp и переход UTC→московская полночь.

**VERIFIED** — mutation self-checks обнаруживают изменения payload, handler argument/control binding, disabled, implicit submit, scheduling arithmetic и нового end-time output. CRLF нормализуется для AST, не удалением значимого текста. Не применялись глобальные regex-исключения функций, вычислений или файлов.

**VERIFIED** — новый mobile `ScheduleTimeline`: ровно два экземпляра в исходнике (исходный desktop + новый mobile); desktop props совпадают с базой целиком. У mobile отличается только `days={[selectedDay]}`; `slots` с прежним service filter, `bookings={filteredBookings}`, `breaks={scheduleBreaks}`, `rules={dayRules}`, `onSlot={setSlotDetails}`, `onBreak={setBreakDetails}` совпадают с исходными props. Проверены enclosing `view !== 'month'` и loading guard. Изолированные AST-мутации selectedDay→rangeStart, подмена onSlot, фильтра и breaks отвергаются. Requests не добавлены.

**VERIFIED** — responsive CSS: mobile timeline скрыт по умолчанию, показан только в media <=640px; desktop-grid скрывается в этом media только под `.admin-calendar-layout:not([data-view="month"])`, поэтому monthly grid этим правилом не скрывается. Это проверка исходных CSS-контрактов, не браузерного computed layout.

## Финальный bounded refinement: Topbar и BookingHistory

**VERIFIED** — просмотрен весь текущий diff Topbar относительно fixed base. В presentation approvals изменены только четыре точных delta: import `UserRound`, attributes native user/help menu, дополнительный button и точный второй search handler; expression delta не изменился. Полное тело `logout` отдельно сравнивается с baseline без стирания JSX/исключений. Сохранены `type="button"`, `disabled={loggingOut}`, `onClick={logout}`, единственный public link с `href="/"`, `target="_blank"`, `rel="noopener noreferrer"` и прежним aria-label. Requests/payload по-прежнему baseline-exact.

**VERIFIED** — menu остаётся native `details`, без принудительного `open` или `role`, c `key={pathname}`. Его первый элемент — `summary` с именем «Меню администратора». Help остаётся вложенным native `details` с текстовым summary; внутри menu ровно один AdminThemeToggle. Основной search label прежний; dropdown search имеет видимый текст «Найти раздел» и `type="button"`. Обе search-кнопки содержат ровно `() => window.dispatchEvent(new Event("admin-navigation-search"))`.

**VERIFIED** — при media <=1023px `.admin-topbar` фиксируется в brand row (`position:fixed`, `top:env(safe-area-inset-top)`, `right:12px`, `min-height:60px`, прозрачный фон, без border). Основной search скрыт, дополнительный находится в user menu; CSS не скрывает сам menu/popover/dropdown search. Разрешено только скрытие декоративного `::-webkit-details-marker`. Эти source assertions не подтверждают отсутствие перекрытий или экономию ровно 60px на фактическом render.

**VERIFIED** — BookingHistory перенесён последним непосредственным DOM-элементом `.healthcare-booking-details`. Полный AST компонента, включая `key={selectedBooking.id}`, `id={selectedBooking.id}` и revision из slot_time/status/historyRevision, совпадает с baseline. В проверяемых booking-details/booking-modal CSS отсутствуют `order`, `grid-row`, `grid-row-start`, `grid-area`. Перенос не потребовал новых AST-исключений bookings: прежние props/handlers/expressions/requests проходят исходные guards.

**VERIFIED** — новый финальный прогон добавляет три группы к предыдущим 75; все 78 прошли, как и вложенные 10 групп DS. Первоначальное ложное срабатывание новой CSS-проверки на скрытом декоративном marker устранено точным исключением только `.healthcare-user-menu > summary::-webkit-details-marker`; ни один runtime-файл не менялся.

## Дополнение: мобильная плотность первого экрана

**VERIFIED** — текущий dashboard diff просмотрен относительно fixed base и предыдущих точных delta. Добавлено одно logic-разрешение: первая KPI label «Ожидающие записи и обращения» → «Ожидают действий». Независимая проверка cards нормализует только эту конкретную строку в первом элементе конкретной переменной `cards`; сохраняет четыре объекта и весь остальной AST, включая value/detail/href/icon/tone. Произвольные label, массив cards или stats не исключены. Mutation self-check подтверждает, что подмена `stats.pendingBookings` на `stats.reviews` обнаруживается.

**VERIFIED** — четыре quick actions имеют ровно прежние destinations с просмотренными короткими текстами: `/admin/bookings?create=1` — «Новая запись», `/admin/bookings` — «Найти клиента», `/admin/slots` — «Расписание», `/admin/payment-links` — «Ссылка на оплату». Handler/request/attribute/expression delta dashboard не менялись; обновлён только точный logic hash. Статистика и backend не менялись.

**VERIFIED** — mobile <=639px: KPI grid из трёх колонок, скрывается только последняя карточка «Отзывы»; исходный массив из четырёх cards сохранён. Quick actions — четыре колонки. Проверено, что скрытие последней KPI находится только в этом breakpoint.

**VERIFIED** — календарные `.healthcare-calendar-title p` и `.admin-calendar-page .healthcare-calendar-stats` скрыты CSS на всех ширинах (не только mobile); сохранены JSX и вычисления. Эти два точных route-local root правила просмотрены отдельно, без общих исключений для скрытия элементов. Только при <=640px `.admin-shell:has(.admin-calendar-page)` скрывает `.admin-mobile-bar` и `.admin-topbar` и снимает padding-top у `.admin-main`; скрывается heading мобильного daily timeline. Monthly date strip скрыт только для `data-view="month"`, сама monthly desktop-grid остаётся доступной по предыдущему guard.

**VERIFIED** — `.admin-shell:has(.admin-calendar-page)` проходит существующий namespace guard без изменений правила scoping. Bottom navigation и sidebar не скрыты этими новыми CSS; кнопка «Ещё»/«Все разделы» сохраняет точный `setCollapsed(false); setMobileOpen(true)` и DOM-контракт. Это подтверждает source-доступность навигации, а не доступность всех Topbar utilities непосредственно на экране календаря.

**VERIFIED** — дополнение добавило две focused группы; итог **80 VERIFIED / 0 BLOCKED**, вложенные 10 DS-групп проходят. Дополнительно просмотрены CSS overflow/max-height user popover, mobile z-index main и static booking footer; runtime не редактировался Гришей.

## Остаточные риски и передача Петровичу

**VERIFIED** — последняя copy-правка AdminToday: `List`, непосредственно отображающий `data.appointments.map`, снова имеет точный baseline title «Приёмы на выбранный день». Обновлён только его attributes delta; logic/expressions/requests/handlers совпали с уже просмотренными контрактами, future-only filter не добавлен. Отдельная регрессия сравнивает title с fixed base, поэтому прошлые и завершённые приёмы больше не описываются как «предстоящие».

**VERIFIED** — финальные mobile <=639px CSS: welcome `min-height:0`, quick actions `min-height:88px`, date label `font-size:0` и gap 0. Native label «Дата по Москве» сохранён в DOM; date input остаётся внутри label, с прежним `aria-label="Дата рабочего дня"` и `value={day}`. Это статическая проверка доступного текста/props, не проверка экранным диктором. Никаких новых runtime/API/вычислительных исключений не добавлено.

**VERIFIED** — окончательный прогон: 81 VERIFIED / 0 BLOCKED, вложенные 10 DS-групп проходят. Изменены только v3-тест и данный отчёт.

**NOT TESTED (Гришей)** — «три визита над сгибом»; положительный результат визуальной проверки предоставлен Петровичем в сообщении. Независимый браузерный прогон здесь не выполнялся.

**NOT TESTED** — браузер, полный render, mobile focus trap/search focus timing, mobile day/week/month navigation, slots/breaks при скрытой CSS desktop-grid, header/help overflow, visual vs DOM order на мобильном dashboard, экранный диктор, MiniCalendar leap-year/navigation runtime, реальная авторизация/DB/providers/production.

**NOT TESTED** — финальный prodlike build: основной агент выполняет его отдельно, этот offline QA не подтверждает его исход. Для свежего build/render проверить native menu через Tab/Enter/Space, вложенный help, переход фокуса dropdown search к sidebar и возможные перекрытия fixed utilities с brand row/drawer; проверить DOM/focus порядок истории в карточке. Здесь браузер и build не запускались.

**NOT TESTED** — итоговая плотность/переносы четырёх quick actions на реальных mobile ширинах и после увеличения шрифта; календарь без brand/topbar, работа «Ещё», возможность перехода к theme/logout/help через навигацию; контекст выбранного дня/МСК после скрытия timeline heading; фактическая видимость monthly grid. Новый render выполняет основной агент; статические CSS guards его не заменяют.

Особенно проверить на свежем render date clear, имя кнопки поиска, computed contrast agenda и slot/break actions в мобильном daily timeline; monthly grid должен оставаться видимым. Это перечень остаточных проверок, не утверждение об их успешности или дополнительных подтверждённых багах. Устаревший dev hot reload/кадр не подтверждает состояние текущих исходников.

Повторный прогон включает booking detail с классом `healthcare-booking-details` и BookingHistory последним в DOM, короткие dashboard labels, CSS density и восстановленный baseline title списка выбранного дня. Запросы, handlers, props и вычисления защищены прежними строгими checks; единственное новое исключение вычислительной проверки — точно просмотренная строка первой KPI label. Окончательный offline-результат: 81 VERIFIED / 0 BLOCKED. По сообщению Петровича дальнейших runtime-правок не планируется; последующие изменения потребуют нового прогона.

Изменены Гришей только `tests/admin-healthcare-v3.cjs` и этот документ. Runtime/инфраструктура/данные не менялись; браузер, SSH, providers, DB, commits и production не использовались. Финальную интеграцию, согласование отклонений scope и браузерную приёмку выполняет Петрович.
