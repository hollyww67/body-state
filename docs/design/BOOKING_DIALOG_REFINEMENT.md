# Booking dialog — reference fidelity fix

Петрович, 17.10.2026. Ветка `feat/admin-healthcare-gap-closure`, база `15df0f2c8830a7c52ca1985d680d44a60540ae80`.

**BOOKING DIALOG REFINED — READY FOR VISUAL REVIEW**

## Изменение

Календарная форма больше не является full-height drawer. На desktop — плавающая карточка шириной440px, с fluid отступом от края, content-based height и max-height740px/доступной высотой viewport. Радиус16px, существующие shadow/border tokens, затемнение native backdrop. Координаты top/left не задаются: положение рассчитывается flex alignment и clamp-padding.

Заголовок и footer вне scroll-region. Поля прокручиваются внутри формы; «Отмена» и «Создать запись» всегда доступны. Клиентский поиск сохранён, имя/телефон рядом на desktop, услуга отдельной строкой, дата/время рядом. Убраны повторяющиеся пояснения и лишние отступы, сохранены все согласия и identity controls. Действие «Добавить только окно» сохранено внутри scroll-region.

На телефоне — full-screen с safe-area, читаемыми полями и отдельной прокруткой. Стили scoped только на `.healthcare-calendar-create`: другая create-форма из списка клиентов и booking details не изменены.

## Границы

Runtime изменён только в `src/app/admin/calendar/page.tsx` и `src/app/admin/healthcare-calendar.css`. Общий `AdminConfirmDialog.tsx` байтово эквивалентен базе: портал/native top-layer/focus trap/Escape/restore/body lock/visualViewport сохранены. Все named calendar functions и mutation payloads неизменны; это проверяют AST regressions. Добавлена только немутирующая нижняя кнопка отмены, с busy guard и теми же reset states, что native onCancel.

Backend/schema/Scheduling/Email/MAX/palette/production не изменены. Реальные платежи/уведомления/записи не создавались; browser QA использует synthetic fixture. Обновлён только локальный QA app на3921, предыдущие контейнеры сохранены остановленными.

## Геометрия финального browser render

| CSS viewport | Card width × height | Right gap | Top gap |
| --- | --- | --- | --- |
| 1920×1080 | 440×740 | 48 | 170 |
| 1440×900 | 440×740 | 43.2 | 80 |
| 768×1024 | 440×740 | 23.04 | 142 |
| 390×844 | ≈390×844 | 0 | 0 |
| 320×740 | 320×740 | 0 | 0 |

В малом mobile viewport390×500 footer остаётся на431.2–500, scrollTop полей376.8: нижние контролы доступны при уменьшении высоты. Это проверка resize/visualViewport-контракта, **не** сертификация реальной экранной клавиатуры iOS/Android.

## QA

- TypeScript, ESLint изменённого TSX, Docker production build --webpack (125 страниц), diff check: PASS.
- `admin-healthcare-gap-closure.cjs`:13 групп PASS — handlers, identity/consent, API/payload, busy, native focus lifecycle.
- `admin-booking-floating.cjs`:5 групп PASS — named bodies, byte-equivalent shared modal, footer guards, consent/identity в scroll-region, scoped responsive CSS.
- `admin-modal.cjs`:PASS; `admin-design-system.cjs`:10 групп PASS.
- Browser: пять размеров, геометрия/скругления/тень, прокрутка, видимость footer, disabled submit без согласия, Shift+Tab wrap, «Отмена», Escape, focus restore, body lock cleanup. Console warning/error inspection — пусто.
- Browser сохранение записи не выполнялось. Domain/core не менялись; не заявляется новый полный E2E/реальная PWA keyboard acceptance.

## Visual evidence

`booking-dialog-refinement/reference-before-after.png` — три колонки **Reference / Before / After**; `reference-before-after-detail.png` — читаемая форма в тех же трёх колонках. Source1536×1024, before/after1440×900. Full-view fit-contain960×680/колонка; focused crops reference432×602, before520×900, after440×740, contain440×900, без растягивания.

`before-1440.png`: drawer520×900 вплотную к краю. Первичная коррекция — `iteration1-1440.png` (440×784.8); после visual QA снижена лишняя высота и обеспечен max740. Финальные `after-{1920,1440,768,390,320}.png` пересняты с настоящего built app. Обе combined sheets просмотрены.

Реальная форма содержит дополнительные юридически значимые поля и «только окно», поэтому выше reference card. Не добавлены отсутствующие специалисты, fake status/comment/notification toggles и повторяющиеся режимы.

QA image: `body-state-admin-booking-floating:qa2`, ID `sha256:e622a2c6394cfc4d5984986e380ae5ef0645a600451eadab92a312d3c39df8aa`.

Preview: `http://localhost:3921/admin/calendar`. Production deployment не выполнялся.
