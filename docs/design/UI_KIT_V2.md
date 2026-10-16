# UI Kit 2.0 — первая очередь

Компоненты `src/components/admin/ui/index.tsx`: AdminButton(primary/secondary/outline/ghost/destructive, sm/md/lg/icon, loading/disabled), AdminInput, AdminTextarea, AdminSelect, AdminField, AdminCheckbox, AdminRadio, AdminSwitch, AdminCard, AdminBadge, AdminSkeleton, AdminEmptyState, AdminStatCard, AdminTable, AdminFeedback. Типы основаны на native React props, поля/кнопки поддерживают ref. Все кнопки по умолчанию type=button; submit указывается явно. Icon-only требует aria-label.

Date/time используют AdminInput type=date/time, без новой зависимости и самостоятельного календарного движка. Native selects сохраняют клавиатурное поведение ОС. Чекбокс/радио/переключатель требуют label; FormField не подменяет validation. Table — семантическая таблица с горизонтальной прокруткой, доступным названием и focus region. Это не новый движок сортировки/пагинации.

Реальное использование: calendar search/filter/view/create form/statistics; BookingStatusBadge использует AdminBadge в существующих карточках; ScheduleTimeline использует общие event/slot/break tokens. Dashboard и общий layout подключены к токенам. Новый набор не заменяет поведение бизнес-компонентов.

Переиспользованы: AdminConfirmDialog/AdminModal, AdminSidebar navigation/search/collapse/mobile drawer, AdminTopbar help/logout/theme, Sonner toast, SchedulingClientPicker, ScheduleTimeline. Их API и обработчики сохранены.

Остаток: полнофункциональные Popover/Dropdown/Tooltip, отдельные Drawer/Tabs/Breadcrumbs/Pagination/Avatar wrappers и DataTable abstraction не объявляются готовыми. При миграции второй очереди сначала переиспользовать существующие паттерны, а не добавлять неиспользуемые abstractions. Общие overlay стили уже обновлены, логика остаётся в существующем dialog.

Пример:

```tsx
<AdminField id="client-name" label="Имя клиента" hint="Как к вам обращаться">
  <AdminInput id="client-name" aria-describedby="client-name-description" required />
</AdminField>
<AdminButton type="submit" loading={saving}>Сохранить</AdminButton>
<AdminBadge tone="success">Подтверждена</AdminBadge>
```
