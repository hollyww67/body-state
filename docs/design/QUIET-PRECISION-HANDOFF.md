# Quiet Precision — handoff / Stage 0

18.10.2026. Петрович. Existing production baseline: `8d6aa48645651c7df827c9dab483cb69318696ed`, image ID `sha256:8dfc8b62f0a5f7b00efa79e6cd367e3f80778186620af9e3fc7d2365c6bb598c`, schema022. Подтверждён read-only release receipt 18.10 06:30:37 UTC; перед новым релизом требуется свежий live preflight, а не предположение о неизменности VPS.

## Визуальная карта

Все шесть реально приложенных PNG открыты и изучены в `C:/Users/user/Downloads/`:

| Референс | Компоненты / применение |
|---|---|
| Элегантный мудборд бренда Body State.png | Wordmark Variation03, serif и палитра: header/footer/public display |
| Система дизайна Body State.png | Централизованные semantic tokens, public/admin scope, 4px spacing, public radius16 |
| UI Kit 2.0_ Система интерфейса заботы.png | Controls, states, focus, feedback, links и forms |
| Презентационная панель мобильного бронирования Body State.png | 4 шага + server-confirmed success, real availability, mobile390 |
| Премиальный сайт клиники Body State.png | Новая композиция `/`, направления/подход/процесс/реальный специалист/отзывы/CTA |
| Дизайн-система Body State_ админ-панель.png | Только цветовая migration, НЕ новая геометрия |

Отдельных файлов ConceptC и desktop02B во вложении нет. Владелец 18.10 подтвердил, что desktop-макета нет. Desktop строится как адаптация имеющейся системы и мобильной02B-M, не выдаётся за просмотр отсутствующей доски; отсутствие отдельного desktop-файла больше не является gate. Шесть приложенных досок — фактический визуальный источник.

## Границы

Сохраняются PR7/8/9/10 ancestry, security/logout/shop race fixes, API, CMS keys, все booking/payment/notification/server domain rules. Старый editorial homepage заменяется; admin TSX/layout/геометрия сохраняются, изменяются только scoped color tokens. Public typography/geometry scoped `.quiet-public`, НЕ admin/video/login оператора.

Маршруты: `/`, `/rehabilitation`, `/bfm`, `/brt`, `/psychology`, `/psychology/[slug]`, `/program`, `/consultation`, `/about`, `/about-rehabilitation`, `/reviews`, `/promotions`, `/contact`, `/blog`, `/blog/[slug]`, `/media`, `/page/[slug]`, `/privacy`, `/oferta`, `/personal-data-consent`, `/consent-publication`, `/review-rules`, `/account`, `/account/reset-password`, `/account/notifications`, `/booking/[service]/[id]`, payment success/fail; `/shop/**` сохраняет OFF gating.

## Ассеты / типографика

В public только существующий logo/icons, нет подтверждённых фотографий новых концептов. Исходники фотографий и векторный wordmark запрошены у владельца. Не генерировать лица сотрудников и не публиковать весь mockup как интерфейс. Photo fidelity — отдельный незакрытый gate. Временный text wordmark не объявляется оригинальным custom logo.

Serif: Playfair Display Cyrillic, self-hosted через next/font; [официальная лицензия SIL OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/OFL.txt), [metadata с cyrillic](https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/METADATA.pb). Sans public — Inter, admin Manrope сохраняется. Старый Cormorant остаётся для существующих reviews. Нет runtime Google font requests.

Палитра брендовых заливок сохранена; muted text #6B6474 вместо слишком светлого #8F95A3, ссылки #645080, focus #7660A6 вместо низкоконтрастного светлого lilac. Необходимые границы полей #8B8495 (Violet #A298AF), декоративные разделители сохраняют #D0D0DB. Buttons lilac + dark ink. Точные контрастные расчёты и browser evidence добавляются при QA.

Свежий production read-only receipt: 18.10.2026 06:47:13.711 UTC — baseline SHA/image совпали, App/PG/Redis healthy, схема022, guards unpaused, shop=false, history/uploads/protected ENV без изменений, business mutations=0. Эти проверки не являются deployment нового Quiet Precision.

## Release gates

Production GO условный, после technical + browser visual QA; до закрытия gates нет deployment. Не запускать платные Actions, реальные платежи/клиентские сообщения. Новый независимый backup/restore и exact artifact required. Магазин остаётся OFF. Physical PWA и actual zoom200 не заменять viewport; старые manual pending не объявлять закрытыми.
