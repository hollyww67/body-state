# Body State — транзакционные email, дизайн PR4

Ответственные: Петрович — интеграция/визуальная проверка; Петя — HTML/text;
Гриша — независимый targeted QA/security review. 15.10.2026.

## Визуальные изменения

Пять основных писем: восстановление доступа, подтверждение/перенос/отмена записи,
подтверждение оплаты. Общий shell распространяется и на оставшиеся виды V1.
Сохранены все десять kinds и legacy exports.

- Существующая светлая палитра сайта: фон #F6F5F2, белый блок, графит #111827,
  teal #0F766E, спокойные серые подписи. Новый бренд/внешние шрифты не добавлялись.
- Контейнер максимум600px, presentation tables/inline CSS/bgcolor,
  MSO width fallback. Нет JS, remote CSS, SVG, flex/grid или тяжёлой графики.
- Читаемый заголовок, карточки услуги/даты/московского времени, для переноса
  отдельно прежняя и новая запись. CTA≥44px, резервная текстовая ссылка.
- Reset: «Сбросить пароль», отдельная TTL-карточка:30минут с момента запроса,
  а не получения письма. Игнорировать предлагается только незапрошенный reset.
- Непонятную запись предлагается проверить через кабинет; автоматическая отмена
  или возврат не обещаются. Payment email не объявляется фискальным чеком.
- Автоматический footer с брендом и body-state.ru. Plain-text сохранён для всех
  видов; MAX admin delivery_alert text побайтно сохранён, клиентский MAX текст
  по-прежнему формируется неизменённым core.

## Логотип

Используется **https://body-state.ru/admin-icons/192.png**: существующий PNG
с тем же фирменным знаком,34785байт; публичный read-only HEAD дал200 image/png.
Он легче исходного /logo.png (1488675байт). Размер в письме64×64, alt="Body State".
Независимый видимый текст BODY STATE остаётся при отключении изображений.
Не используются нестабильный optimizer URL, tracking pixel или новый CDN.

## Preview для всех пяти

Команда: `node scripts/preview-notification-emails.cjs`.
Результат: `artifacts/notification-email-design/index.html` и по пять отдельных
HTML, plain-text, image-free страниц. На момент проверки локальная галерея:
http://127.0.0.1:3910/ (loopback-only, не публичная публикация).

Файлы: password-reset, booking-confirmed, booking-rescheduled, booking-cancelled,
payment-confirmed с расширениями .html/.txt; screenshots *-desktop.jpg/*-mobile.jpg.
Все данные синтетические; preview reset token явно недействующий.

## Проверки и границы evidence

- Desktop1280 и mobile320/390 CSSpx: все пять HTML открыты, screenshots сохранены.
  Горизонтального overflow нет, CTA и карточки читаемы. Viewport — не физический
  iPhone/Android и не доказательство отображения в Apple Mail/Outlook/Yandex Mail.
- Все пять image-free вариантов проверены: логотип отсутствует, текстовый бренд,
  смысл, детали и CTA сохраняются. Вариант image-free — явная preview-симуляция.
- Пять HTML/text SHA256 snapshots, DOM-контракты email-safe tables, origin всех
  ссылок, экранирование, TTL, missing payment facts и точный MAX admin text.
- Существующие SMTP/TLS/template/MIME tests проходят без внешних отправок:
  multipart/alternative с HTML+text в памяти. Сохраняются strict origin URL,
  запрет naive даты и Europe/Moscow; injection не проходит.
- Core PostgreSQL20 групп, полная изолированная регрессия53+9+21,
  TypeScript/ESLint PASS. Hosted CI относится только к SHA, указанному в PR evidence.
- Production/SMTP/cron/ENV/MAX/Scheduling V2/migrations не изменялись. Ни одного
  письма или настоящего reset-запроса в рамках дизайн-задачи не отправлено.

## Ограничение данных payment email

Фактический текущий V1 payload НЕ передаёт amount/paidAt. Нельзя назвать цену
процедуры фактически оплаченной суммой или дату отправки датой платежа.
Шаблон поддерживает эти поля только при наличии проверенных данных; при их
отсутствии честно показывает услугу (если передана) и ссылку на кабинет.
В preview отражён именно существующий payload, не придуманные payment facts.
Подключение суммы/даты к каждому виду заказа/приёма требует отдельного
presentation-data патча и проверки источника этих фактов; это не сделано скрыто.

## Следующий smoke

Готово к **одному дополнительному письму только после отдельного разрешения**:
указать один тестовый адрес и выбранный шаблон. Использовать только синтетические
данные/недействующий reset link, не настоящий клиентский reset. Отправить один
раз без retry, записать timestamp/code и отдельно проверить inbox/spam/HTML/text,
images-off и заголовки SPF/DKIM/DMARC. Эти результаты нельзя получить из browser
preview или прежнего plain-text SMTP accepted250. Авторассылки не включать.
