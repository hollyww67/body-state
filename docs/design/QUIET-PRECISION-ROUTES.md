# Quiet Precision — route inventory

Baseline `8d6aa486`. Реальные filesystem routes, без дублирующих страниц. Статус в этом файле — карта применения, НЕ автоматический browser PASS.

| Семейство | Маршруты | Источник / сохранённое поведение | Визуальный слой |
|---|---|---|---|
| Главная | `/` | usePageCopy(home), published EditorialReviews, реальные ссылки | Новая композиция QuietHome |
| Запись / направления | `/rehabilitation`, `/bfm`, `/brt` | Цены getServicePrice, реальные GET slots, общий POST book, BRT не включается в общий chooser | Общие tokens + wizard/calendar |
| Психология | `/psychology`, `/psychology/[slug]` | Каталог и CMS, programId/цена из БД | Shared chrome/typography, тот же wizard |
| Программы | `/program` | Существующий контент и CTA | Shared chrome/tokens |
| Обращение без слота | `/consultation` | POST consultation, не превращается в booking/payment | Общие поля/feedback/стиль |
| Информация | `/about`, `/about-rehabilitation`, `/contact` | page_content/CMS, about_documents, реальные legalDetails | Shared typography/surfaces |
| Отзывы / акции | `/reviews`, `/promotions` | Только настоящие опубликованные данные, жалоба на отзыв сохраняется | Общие карточки/controls |
| Контент | `/blog`, `/blog/[slug]`, `/media`, `/page/[slug]` | published/CMS sanitized HTML, динамические slug | Общие шрифты/сетка/surfaces |
| Юридические | `/privacy`, `/oferta`, `/personal-data-consent`, `/consent-publication`, `/review-rules` | Текущие юридические тексты/ссылки не переписываются ради дизайна | Readable typography + shared chrome |
| Клиент | `/account`, `/account/reset-password`, `/account/notifications` | Login/register/forgot/profile/visits/rewards/order/history, auth unchanged | Quiet public forms/surfaces, sans UI |
| Запись / платёж | `/booking/[service]/[id]`, `/payment/success`, `/payment/fail` | Auth guest/session unchanged, durable receipt/status, no false paid state | Состояния и links в кабинет вместо скрытой корзины |
| Магазин | `/shop`, `/shop/[slug]`, `/shop/cart`, `/shop/checkout` | Existing settings.shop_visible gate, API and sitemap, default OFF | Shared tokens when enabled, no data deletion |
| Админка | Все `/admin/**` | Existing layout/components/API/Manrope/PWA | Только scoped color migration |
| Оператор / комнаты | `/login`, `/psychology/room`, `/psychology-room/[id]` | Существующий operator auth и video controls | Исключены из public geometry |
| Утилиты | `/qr` | Существующая utility page | Shared palette, не выдаётся за новый продуктовый экран |

Отдельных публичных `/register` и `/forgot-password` нет: режимы находятся в AccountClient. Новые дубль-маршруты не создаются. Динамические slug и реальные фото/тексты требуют fixtures при isolated QA; пустой каталог не считается проверкой всех состояний.
