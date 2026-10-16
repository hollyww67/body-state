# UI Kit 2.0

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

## Phase 2

Добавлены только два общих presentation-компонента: `AdminPageHeader` (title/description/toolbar) и `AdminLoadingState` (role=status, декоративный spinner). Они не загружают данные и не меняют lifecycle. Existing primitives и их native props сохранены.

`phase2.css` подключён после foundations; классы `bs-page`, `bs-toolbar`, `bs-form`, `bs-split`, `bs-money`, `bs-muted` унифицируют композицию. Денежные значения используют tabular numbers. `bs-savebar` поднимает sticky submit над мобильной навигацией с safe-area. Палитра и violet overrides первой очереди не меняются.

Клиенты/заказы сохраняют существующее карточное и kanban-представление. Не введён новый DataTable engine. Native таблицы программ сохраняют DnD-контекст с общими `bs-table` стилями и локальной горизонтальной прокруткой. Native selects/date/time остаются системными.

Контентные редакторы и загрузчики не переписаны: DS2 применяется к их административному окружению. Public FileUploader/TipTapEditor не меняются. Существующий AdminConfirmDialog остаётся единственным приложенческим механизмом модальных подтверждений; его focus/busy/error guards не заменены.
