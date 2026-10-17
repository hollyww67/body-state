# Stage 3.1 — Visual gap report

17.10.2026, Петрович/Петя. Сравнивались предоставленные PNG и настоящий built QA app, не исходный код вместо изображения.

## Закрыто

- Mobile booking: client-modal → цельный full-screen экран записи, header/back/status/ID, контактная карточка, четыре вкладки, scroll/action bar.
- Mobile calendar: day entry, дата/недельная лента сразу под заголовком, раскрываемые инструменты, настоящий timeline и нижняя навигация.
- Mobile Dashboard: KPI → действия → ближайшие подтверждённые приёмы → заказы; операционные задачи сохранены ниже.
- Desktop calendar: week entry, направления и рабочий контекст справа, быстрые действия на выбранный день.
- Creation: общая right-side native panel, клиент/приём/подтверждение, существующая identity/consent/busy защита.

Evidence: `screenshots-stage3-1/compare-{dashboard,calendar,calendar-form,mobile-dashboard,mobile-calendar,mobile-booking}.png`. Все пары reference-left / implementation-right созданы и просмотрены.

## Итерация

P2 первой проверки: постоянные search/filter/modes вытесняли дату и записи на телефоне. Исправлено раскрытием кнопкой с aria-expanded; сохранены все режимы. После новой сборки повторно проверены320/390 и переснят calendar390. Исходная итерация — `calendar-390-qa1.png`.

При интеграции закрыт дополнительный риск закрытия create-формы из списка во время сохранения; regression suite проверяет оба механизма закрытия и обнаруживает удаление guard.

## Намеренно сохранено / domain limits

- Реальный логотип, Manrope, токены, библиотечные иконки; нет вымышленных фотографий клиентов, используются инициалы.
- Специалисты заменены реальными направлениями; fake specialists/rooms не добавлены.
- KPI, суммы и история не выдуманы; нет ложных revenue trends, чеков и отметок доставки уведомлений.
- «Изменить» открывает поддерживаемый перенос. «Дублировать» отсутствует, пока нет безопасного domain action.
- Высота событий соответствует настоящим 90мин, не демонстрационным 60мин на PNG; arithmetic не менялась ради картинки.
- Native backdrop/focus containment сохранён; не копируется небезопасный немодальный overlay.

## Остатки / следующий этап

P3: последующая подстройка desktop-плотности и старых англоязычных history labels после owner review. Domain proposals: редактирование заметок, payment read-model, специалисты/кабинеты, безопасное копирование.

Actual zoom200 и физические PWA iOS/Android — MANUAL PENDING; viewport не выдаётся за device acceptance. Основные reference UX patterns реализованы; готово к визуальной приёмке владельцем. Production не изменён.
