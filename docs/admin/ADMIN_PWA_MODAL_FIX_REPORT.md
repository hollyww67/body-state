# ADMIN PWA MODAL FIX REPORT

Дата: 10 октября 2026, Москва.

**Статус: исправлено в изолированной копии; локальные браузерные проверки выполнены. Real-device/standalone acceptance BLOCKED — устройства недоступны. Production не изменён.**

## Root cause — подтверждено браузером, не гипотеза

`src/app/globals.css`: `main { position: relative; z-index: 1; }`. Это создаёт stacking context у `.admin-main`.
Старое подтверждение находится внутри main, его `position:fixed; z-index:100` не может выйти из родительского слоя 1. Нижняя навигация — sibling со слоем 45, mobile bar — 50, sidebar — 60. Она перекрывает модалку независимо от числа 100 у потомка.
Mobile CSS дополнительно прижимает все `.admin-content .fixed.inset-0` вниз и ограничивает их содержимое общими правилами. Удаление не имеет `aria-modal`, поэтому старый workaround `.admin-main:has([aria-modal=true])` для него не срабатывает.
В browser inspection у main: position relative/z1/overflow clip visible; у overlay z100/backdrop blur4; transform предков отсутствует в момент измерения. Нельзя приписывать проблему неподтверждённому transform. Sidebar/topbar имеют собственные stacking contexts/backdrop-filter; анимации могут создавать дополнительные, но не являются необходимой причиной этого воспроизведения.

## Исправление

- Новый `src/components/admin/AdminConfirmDialog.tsx`: React Portal в body + native `dialog.showModal()` в browser top layer. Не произвольное увеличение z-index, без новой библиотеки.
- Общее modal primitive также экспортируется как `AdminModal`; применяется к новой записи, карточке клиента, карточке заказа и двум формам календаря.
- `aria-modal`, доступное имя, alertdialog для удаления/dialog для форм, безопасный начальный фокус, Tab/Shift+Tab trap, Escape, возврат фокуса при закрытии к существующему trigger.
- Native modal делает фоновый документ inert. Body scroll lock сохраняет позицию; listeners visualViewport resize/scroll и window resize очищаются при unmount.
- Safe-area padding, visual viewport height/offset, внутренний overflow и несжимаемый footer подтверждения. Touch targets подтверждения 48px.
- Синхронный ref блокирует повтор запроса до React rerender. При pending отмена/Escape блокируются; при ошибке сообщение остаётся внутри окна, начальный фокус возвращается к отмене. Успех закрывает окно и обновляет список.
- Убрано преждевременное/ошибочное закрытие в bookings/orders/slots. Серверные правила, API, статусы и платёжная логика не менялись.
- В истории заказов безымянные icon buttons получили aria-label и размер не менее 44px.
- При выносе форм Portal вскрыл старое правило прозрачного фона прямого потомка `.admin-content`; добавлено узкое правило непрозрачного фона только для modal panel. Проверено после завершения анимации.

Текст удаления записи: «Удалить запись?» / «Вы действительно хотите удалить эту запись? Это действие может быть необратимым.» / «Отмена» / «Удалить».
Закрытие overlay не подтверждает удаление: на overlay вообще нет destructive handler.

## Проверки

| Сценарий | Результат и доказательство |
| --- | --- |
| Исходный дефект | Воспроизведён в отдельной baseline-копии, кнопки под нижней панелью |
| 320×568, 375×667, 390×844, 393×852, 430×932 | PASS desktop responsive: кнопки внутри viewport, hit test возвращает кнопку |
| 844×390 landscape, 320×280 short, 1280×800 desktop | PASS для подтверждения |
| Overlay поверх nav | PASS: native :modal, screenshot, hit tests; фон исключён из accessibility tree |
| Tab / Shift+Tab | PASS после явного trap; первоначально найден выход из диалога и исправлен |
| Escape / Отмена / scroll restore / focus return | PASS; после Escape фокус вернулся на кнопку «Удалить» и body position восстановлен |
| API error | PASS: статус синтетической consultation изменён в QA DB на confirmed; API вернул 400, сообщение осталось в диалоге |
| API success | PASS: статус QA-записи возвращён в completed; DELETE удалил только эту тестовую запись, count в QA DB стал 0, диалог закрылся |
| Duplicate click / busy cancel / success / error / error text / Escape | PASS, 6 component event tests; не измерение реального мобильного double tap |
| Длинный текст, 320×280 | PASS: body scrollable, высота 147px, обе кнопки заканчиваются на y259.2 и доступны |
| Новая запись | PASS opening/closing/background/focus, внутренний scroll на 320×568; отправка формы в этом этапе не тестировалась |
| Карточка заказа | PASS opening/closing через общий dialog на 390×844 |
| Удаление заказа | PASS opening/cancel на синтетическом заказе; отдельный DELETE заказа не выполнялся |
| Подтверждение удаления слотов | PASS: повторяемый browser regression на 8 размерах, Tab/Shift+Tab/Escape; DELETE не отправлялся |
| Календарь: формы записи и перерыва | PASS opening/closing/Escape, начальный фокус на закрытии; submit не выполнялся |
| Existing PWA shell + payment + integration | PASS unit и 34 integration; auth login в локальной админке PASS |
| Реальные iOS Safari / iOS standalone / Android Chrome / Android installed | BLOCKED — устройств нет; responsive не считается PASS |
| Реальная виртуальная клавиатура и системный крупный шрифт | BLOCKED; короткий viewport проверен, это не эквивалент OS keyboard/font test |

Если trigger удалён вместе с записью, cleanup направляет фокус на главный заголовок страницы; возврат к существующему trigger проверен для отмены/Escape. Fallback после удаления нужно отдельно проверить с экранным диктором при device QA.

## Аудит остальных действий

| Область | Решение |
| --- | --- |
| bookings: создание, детали | Тот же вложенный overlay; переведены на общий top layer. Формы бизнес-логики не переписаны |
| orders: удаление, drawer | Тот же stacking context; исправлены прямые потребители |
| slots: удаление группы | Общий confirm, ошибка не закрывает, loading в dialog; серверный endpoint прежний |
| calendar: новая запись/перерыв | Те же inline fixed overlays; переведены на общий primitive; полный сценарий submit не проверен |
| products/media/psychology/reviews/rooms | Используют native window.confirm, не затронуты CSS layering. Не заменялись без необходимости |
| отмена записей/финансовые действия/уведомления | Не переработаны. Не заявляется полный функциональный аудит всех действий; бизнес-изменения вне Stage 0.5 |

## Доказательства

До: [320×568](../../../evidence/before-320x568.png).
После: [320×568](../../../evidence/after-320x568.png), [390×844](../../../evidence/after-390x844.png), [desktop](../../../evidence/after-1280x800.png).
Дополнительно: [длинный текст](../../../evidence/long-text-320x280.png), [API error](../../../evidence/api-error-320x568.png), [форма](../../../evidence/new-booking-320x568.png), [заказ](../../../evidence/order-detail-390x844.png), [удаление заказа](../../../evidence/order-confirm-390x844.png).
Геометрия: `../../../evidence/modal-viewports.json`, повторный автоматизированный CUA-прогон — `../../../evidence/browser-regression-final.json`. Скриншоты содержат только синтетические тестовые данные.

Повторяемые проверки: `node tests/admin-modal.cjs`. `tests/admin-modal-browser.mjs` запускается в CUA runtime с уже открытым QA alertdialog и viewport capability; разрешает только localhost:3155, проверяет размеры/клавиатуру и не отправляет DELETE. Не запускается автоматически обычным CI без browser runtime.

## Поставка

Независимый PWA patch, НЕ реальный PR. После согласования восстановления Git-базы — ветка `fix/admin-pwa-modal-layering` и отдельный review. Deploy запрещён текущим заданием. Financial Stage 1 не начат.
Рекомендации React повлияли на очистку effects и управление фокусом; end-to-end verification использована для проверки реального локального API и синтетической DB, не только скриншотов.
