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

Вторая очередь НЕ завершена: клиенты/записи full page, orders/payments/payment links, slots/templates/batch forms, content editors/settings/notifications и остальные разделы. На них применяются общие shell tokens и некоторые общие badges/dialogs, но это не равнозначно полной миграции страниц. Не удалять legacy admin.css до завершения миграции и visual regression всех routes.

Release только после отдельного owner GO, обычного immutable image QA и app-only runbook. Миграции DB не нужны. Rollback — предыдущий app image при сохранении данных/schema. Не включать MAX V2 или изменять Email вместе с визуальным релизом.
