# Healthcare UI Kit V3

Используются фактические компоненты из `src/components/admin/ui/index.tsx`. Не добавлена параллельная UI-библиотека.

| Компонент | Варианты и состояния |
|---|---|
| AdminButton | primary, secondary, outline, ghost, destructive; sm/md/lg/icon; loading, disabled, focus |
| AdminInput / Select / Textarea | native props/ref, label, hint, error, disabled; mobile 16px |
| AdminField | связанные label/id, подсказки и alert ошибки |
| AdminCard / StatCard | белая поверхность, тонкая граница, мягкая тень, tabular values |
| AdminBadge / BookingStatusBadge | текст + декоративная точка; success/warning/info/destructive/neutral |
| AdminTable | semantic table, заголовки и локальный scroll region |
| AdminEmptyState / Skeleton / Feedback | настоящие empty/loading/error состояния без вымышленных данных |
| AdminPageHeader | общая иерархия заголовков и действий |
| AdminConfirmDialog / AdminModal | существующий native top layer, focus trap, Escape, busy protection, scroll lock |
| AdminSidebar / Topbar | действующие routes/права, поиск разделов, native user/help disclosure, optional theme |
| AdminToday | реальные визиты, инициалы, agenda и раскрываемые операционные задачи |
| ScheduleTimeline | прежняя геометрия интервалов, реальные breaks/slots, service styling и текстовый статус |
| HealthcareMiniCalendar | локальное переключение месяца, московская сегодняшняя дата; без API |

Native props, refs, loading/disabled truth table, default button type, focus и reduced motion проверены прежними DS-тестами. Requests/payloads и scheduling arithmetic отдельно защищены Stage3 guards относительно фиксированной production-базы.

На телефоне карточка клиента сохраняет сведения о согласии и безопасную ручную привязку кабинета. История перенесена последней **в DOM**, без CSS order. Footer действий не перекрывает содержимое на телефоне. Общая дополнительная кнопка «Закрыть» сохранена: её удаление потребовало бы отдельного изменения контракта native modal, здесь он не ослаблен.
