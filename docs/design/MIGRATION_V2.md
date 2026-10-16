# План миграции и карта компонентов

| Область | Что сохраняется | Изменение первой очереди |
| --- | --- | --- |
| Admin layout/sidebar/topbar | routes, auth, collapse, search, mobile focus/inert, help, logout, theme | токены, логотип, размеры/отступы, skip-link |
| Dashboard / AdminToday | текущие endpoints, all-time метрики, реальные задачи | приветствие, иерархия, основной столбец+sidebar, карточки |
| Calendar month/week/day | Moscow/date arithmetic, intervals, alternative slots, handlers | toolbar/buttons/fields/stats, семантические поверхности |
| ScheduleTimeline | overlap math, duration geometry, selected slot identity | общие event/slot/break классы |
| BookingStatusBadge | domain statuses/labels | общий AdminBadge |
| Native dialogs | focus trap/restore, cancel/busy guards, portal, visualViewport | radius/elevation/form styles |

Не заменять public `components/ui/button,input,card`: их используют посетители. Admin primitive scope позволяет поэтапную миграцию без переписывания storefront. Дублирование dashboard badge постепенно убирать после проверки доменных различий orders/appointments.

## Phase 2 — фактическая миграция

База `d43d1684e6bd70cb1ee8dc14fd36b79ceb15ae53`, ветка `feat/admin-design-system-v2-phase2`.

| Batch | Страницы и компоненты | Граница |
| --- | --- | --- |
| 1 | bookings, BookingCard/Search/Filters, BookingHistory, SchedulingClientPicker | поиск, карточка клиента, история, поля и статусы; handlers/API сохранены |
| 2 | orders, payment-links, PaymentCases | kanban, детали заказа, финансовые состояния и формы; суммы и банковские контракты сохранены |
| 3 | slots, SchedulingTemplates, ScheduleBreakEditor | фильтры, даты, перерывы, шаблоны и предпросмотр; scheduling math не менялась |
| 4 | prices, products, psychology/list+editor, media/list+editor, pages/list+editor, AboutDocumentsEditor | DS2 поля, таблицы, карточки, загрузчики в прежнем окружении |
| 4 | promo-codes, promotions, loyalty, reviews, settings, faq, psychology-rooms, NotificationJournal, MaxNotificationBinding | общие формы/статусы/feedback; каналы и бизнес-обработчики не меняются |
| 5 | общие primitives, phase2.css, offline AST guard, synthetic fixture, responsive/browser evidence | итоговые результаты и оставшиеся ограничения — в PHASE2_IMPLEMENTATION_REPORT.md |

`/admin` и `/admin/consultations` остаются redirect-маршрутами. Отдельных страниц clients/blog в текущем дереве нет: новые разделы не созданы. Dashboard/calendar/layout используют утверждённую первую очередь, без нового редизайна.

Legacy `admin.css` не удалён: он по-прежнему содержит используемую структуру shell, payment-link composition, editor и PWA. Удаление без доказательства отсутствия зависимостей было бы регрессией. Новая страничная вёрстка потребляет DS2 tokens, а не вводит вторую палитру. Остаточные shared public editor controls не переписаны ради косметики.

Release только после отдельного owner GO, обычного immutable image QA и app-only runbook. Миграции DB не нужны. Rollback — предыдущий app image при сохранении данных/schema. Не включать MAX V2 или изменять Email вместе с визуальным релизом.
