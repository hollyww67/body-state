export type EditableField = {
  key: string;
  label: string;
  defaultValue: string;
  multiline?: boolean;
  rows?: number;
};

export type EditablePage = {
  slug: string;
  title: string;
  route: string;
  group: "Основные" | "Услуги" | "Информация" | "Юридические";
  description: string;
  fields: EditableField[];
};

export const editablePages: EditablePage[] = [
  {
    slug: "home", title: "Главная", route: "/", group: "Основные", description: "Первый экран, направления, подход, этапы и запись",
    fields: [
      { key: "heroEyebrow", label: "Первый экран · надзаголовок", defaultValue: "Реабилитолог • Хотьково" },
      { key: "heroTitle", label: "Первый экран · заголовок", defaultValue: "Через тело" },
      { key: "heroAccent", label: "Первый экран · выделенная строка", defaultValue: "к состоянию" },
      { key: "heroDescription", label: "Первый экран · описание", defaultValue: "Социально-психологическая и физическая реабилитация. Помогаю восстановить ресурс организма через бережные методы работы с нервной системой и телом.", multiline: true },
      { key: "methodsTitle", label: "Направления · заголовок", defaultValue: "Два направления восстановления" },
      { key: "methodsDescription", label: "Направления · описание", defaultValue: "Индивидуальный подход: от психологической поддержки до физической реабилитации.", multiline: true },
      { key: "method1Title", label: "Направление 1 · заголовок", defaultValue: "Психологическая реабилитация" },
      { key: "method1Text", label: "Направление 1 · описание", defaultValue: "Восстановление эмоционального ресурса и психологического благополучия.", multiline: true },
      { key: "method2Title", label: "Направление 2 · заголовок", defaultValue: "Физическая реабилитация" },
      { key: "method2Text", label: "Направление 2 · описание", defaultValue: "Мягкое восстановление подвижности, работа с фасциальной системой и мышечными зажимами.", multiline: true },
      { key: "philosophy", label: "Цитата", defaultValue: "Реабилитация — это не борьба. Это возвращение к себе через бережное восстановление нервной системы и тела.", multiline: true },
      { key: "philosophyNote", label: "Подпись под цитатой", defaultValue: "Каждый метод подобран с учётом вашего состояния и готовности к изменениям.", multiline: true },
      { key: "processTitle", label: "Процесс · заголовок", defaultValue: "Процесс работы" },
      { key: "processDescription", label: "Процесс · описание", defaultValue: "Четыре шага к восстановлению." },
      { key: "process1Title", label: "Шаг 1 · заголовок", defaultValue: "Знакомство" },
      { key: "process1Text", label: "Шаг 1 · описание", defaultValue: "Обсуждаем ваш запрос, историю и текущее состояние.", multiline: true },
      { key: "process2Title", label: "Шаг 2 · заголовок", defaultValue: "Консультация" },
      { key: "process2Text", label: "Шаг 2 · описание", defaultValue: "Определяем подходящие методы реабилитации.", multiline: true },
      { key: "process3Title", label: "Шаг 3 · заголовок", defaultValue: "Практика" },
      { key: "process3Text", label: "Шаг 3 · описание", defaultValue: "Реабилитационная работа по индивидуальной программе.", multiline: true },
      { key: "process4Title", label: "Шаг 4 · заголовок", defaultValue: "Поддержка" },
      { key: "process4Text", label: "Шаг 4 · описание", defaultValue: "Сопровождение и рекомендации между сессиями.", multiline: true },
      { key: "reviewsTitle", label: "Отзывы · заголовок", defaultValue: "Что говорят клиенты" },
      { key: "ctaTitle", label: "Финальный блок · заголовок", defaultValue: "Готовы начать восстановление?" },
      { key: "ctaDescription", label: "Финальный блок · описание", defaultValue: "Первая консультация поможет определить направление реабилитации и составить индивидуальную программу.", multiline: true },
      { key: "ctaButton", label: "Финальный блок · кнопка", defaultValue: "Записаться на консультацию" },
      { key: "heroButton", label: "Quiet Precision · кнопка первого экрана", defaultValue: "Записаться на приём" },
      { key: "heroSecondary", label: "Quiet Precision · ссылка о подходе", defaultValue: "Узнать о подходе" },
      { key: "heroImage", label: "Quiet Precision · фото первого экрана (URL разрешённого изображения)", defaultValue: "" },
      { key: "heroImageAlt", label: "Quiet Precision · описание фото первого экрана", defaultValue: "Пространство Body State" },
      { key: "physicalImage", label: "Quiet Precision · фото физической реабилитации (URL)", defaultValue: "" },
      { key: "psychologyImage", label: "Quiet Precision · фото психологической реабилитации (URL)", defaultValue: "" },
      { key: "philosophyTitle", label: "Quiet Precision · философия, заголовок", defaultValue: "Забота начинается с внимания" },
      { key: "specialistTitle", label: "Quiet Precision · специалист, заголовок", defaultValue: "Личное внимание к вашему запросу" },
      { key: "specialistName", label: "Quiet Precision · имя реального специалиста", defaultValue: "Алёна Танчук" },
      { key: "specialistDescription", label: "Quiet Precision · о специалисте", defaultValue: "Социально-психологическая и физическая реабилитация. Подробнее о специалисте, подходе к работе, дипломах и сертификатах — на странице знакомства.", multiline: true },
      { key: "specialistImage", label: "Quiet Precision · реальное фото специалиста (URL)", defaultValue: "" },
    ],
  },
  {
    slug: "rehabilitation", title: "Реабилитация", route: "/rehabilitation", group: "Услуги", description: "Описание направлений и блок записи",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Реабилитация" },
      { key: "title", label: "Заголовок", defaultValue: "Восстановление ресурса организма" },
      { key: "lead", label: "Первый абзац", defaultValue: "Реабилитация — это комплекс мер, направленных на восстановление психологического и физического благополучия. Я использую бережные методы, которые помогают организму восстановиться естественным путём, без насилия и принуждения.", multiline: true },
      { key: "leadSecond", label: "Второй абзац", defaultValue: "Начинаем с психологической поддержки — это основа. Затем подключаем физическую реабилитацию. Программа подбирается индивидуально после консультации.", multiline: true },
      { key: "service1Title", label: "Психологическая реабилитация · заголовок", defaultValue: "Психологическая реабилитация" },
      { key: "service1Description", label: "Психологическая реабилитация · описание", defaultValue: "Восстановление эмоционального ресурса и психологического благополучия. Помощь в преодолении тревожности, стресса, эмоционального выгорания. Поддержка в сложных жизненных ситуациях.", multiline: true },
      { key: "service1Details", label: "Психологическая реабилитация · пункты (каждый с новой строки)", defaultValue: "Восстановление эмоционального баланса\nРабота с тревожностью и стрессом\nПреодоление эмоционального выгорания\nПсихологическая поддержка", multiline: true },
      { key: "service2Title", label: "Физическая реабилитация · заголовок", defaultValue: "Физическая реабилитация" },
      { key: "service2Description", label: "Физическая реабилитация · описание", defaultValue: "Консультация по социальной адаптации через бережное восстановление тела.", multiline: true },
      { key: "service2Details", label: "Физическая реабилитация · пункты (каждый с новой строки)", defaultValue: "Снятие мышечных зажимов и напряжения\nВосстановление подвижности суставов\nУлучшение эластичности фасций\nНормализация работы вегетативной нервной системы", multiline: true },
      { key: "service3Title", label: "БРТ · заголовок", defaultValue: "Биорезонансная коррекция -- Услуга не оказывается." },
      { key: "service3Description", label: "БРТ · описание", defaultValue: "Оздоровительная программа, направленная на нормализацию состояния организма через биорезонансный подход. Способствует восстановлению внутренних ресурсов и улучшению общего самочувствия.", multiline: true },
      { key: "service3Details", label: "БРТ · пункты (каждый с новой строки)", defaultValue: "Нормализация общего состояния организма\nВосстановление внутренних ресурсов\nУлучшение самочувствия\nПоддержка процессов саморегуляции", multiline: true },
      { key: "bookingTitle", label: "Блок записи · заголовок", defaultValue: "Записаться на процедуру" },
      { key: "bookingHint", label: "Подсказка под формой", defaultValue: "Не знаете, с чего начать? Запишитесь на консультацию — мы обсудим ваш запрос и подберём направление.", multiline: true },
    ],
  },
  {
    slug: "about-rehabilitation", title: "О реабилитации", route: "/about-rehabilitation", group: "Информация", description: "Подробное объяснение подхода, направлений и этапов реабилитации",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "О реабилитации" },
      { key: "title", label: "Заголовок", defaultValue: "Восстановление начинается с понимания себя" },
      { key: "lead", label: "Вводный текст", defaultValue: "Реабилитация — это последовательный путь к более устойчивому состоянию, в котором внимание к психике и телу дополняют друг друга. Работа строится бережно, индивидуально и в комфортном для человека темпе.", multiline: true },
      { key: "definitionTitle", label: "Определение · заголовок", defaultValue: "Что мы называем реабилитацией" },
      { key: "definitionText", label: "Определение · текст", defaultValue: "Это не набор универсальных процедур, а продуманный процесс восстановления повседневного ресурса. Сначала мы знакомимся с запросом и текущим состоянием, затем выбираем подходящее направление и выстраиваем реалистичный маршрут работы.", multiline: true },
      { key: "psychologyTitle", label: "Психологическое направление · заголовок", defaultValue: "Психологическая реабилитация" },
      { key: "psychologyText", label: "Психологическое направление · текст", defaultValue: "Помогает внимательнее отнестись к эмоциональному состоянию, внутреннему напряжению и повторяющимся жизненным сценариям. Формат подбирается по запросу: очные или онлайн-встречи и тематические программы.", multiline: true },
      { key: "physicalTitle", label: "Физическое направление · заголовок", defaultValue: "Физическая реабилитация" },
      { key: "physicalText", label: "Физическое направление · текст", defaultValue: "Бережная работа с телом, дыханием, подвижностью и ощущением напряжения. Задача — поддержать адаптацию, вернуть больше свободы движения и сформировать внимательное отношение к сигналам тела.", multiline: true },
      { key: "processTitle", label: "Этапы · заголовок", defaultValue: "Как строится работа" },
      { key: "step1Title", label: "Этап 1 · заголовок", defaultValue: "Знакомство" },
      { key: "step1Text", label: "Этап 1 · текст", defaultValue: "Обсуждаем запрос, ожидания и важные особенности текущего состояния.", multiline: true },
      { key: "step2Title", label: "Этап 2 · заголовок", defaultValue: "Выбор направления" },
      { key: "step2Text", label: "Этап 2 · текст", defaultValue: "Определяем, с чего разумнее начать: с психологической или физической реабилитации.", multiline: true },
      { key: "step3Title", label: "Этап 3 · заголовок", defaultValue: "Индивидуальная работа" },
      { key: "step3Text", label: "Этап 3 · текст", defaultValue: "Двигаемся последовательно, отслеживая самочувствие и изменения после встреч.", multiline: true },
      { key: "step4Title", label: "Этап 4 · заголовок", defaultValue: "Закрепление" },
      { key: "step4Text", label: "Этап 4 · текст", defaultValue: "Формируем понятные способы поддерживать своё состояние в повседневной жизни.", multiline: true },
      { key: "principlesTitle", label: "Принципы · заголовок", defaultValue: "На чём держится подход" },
      { key: "principles", label: "Принципы (каждый с новой строки)", defaultValue: "Индивидуальный маршрут вместо шаблонной схемы\nБережный темп без давления и форсирования\nПонятные цели и внимание к обратной связи\nСвязь психологического состояния и телесных ощущений", multiline: true },
      { key: "notice", label: "Важное примечание", defaultValue: "Услуги имеют реабилитационную и поддерживающую направленность, не являются медицинской диагностикой или лечением и не заменяют обращение к врачу. При острых симптомах или ухудшении самочувствия необходимо обратиться за медицинской помощью.", multiline: true },
      { key: "ctaTitle", label: "Финальный блок · заголовок", defaultValue: "Выберите подходящее направление" },
      { key: "ctaText", label: "Финальный блок · текст", defaultValue: "Можно познакомиться с психологическими программами или сразу выбрать время для физической реабилитации.", multiline: true },
    ],
  },
  {
    slug: "psychology", title: "Психологическая реабилитация", route: "/psychology", group: "Услуги", description: "Вводный текст каталога программ психологической реабилитации",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Психологическая поддержка" },
      { key: "title", label: "Заголовок", defaultValue: "Пространство для внутренней опоры" },
      { key: "lead", label: "Описание", defaultValue: "Бережные индивидуальные программы, которые помогают лучше понять своё состояние, вернуть устойчивость и двигаться дальше в комфортном темпе.", multiline: true },
      { key: "loading", label: "Текст загрузки", defaultValue: "Подбираем программы…" },
    ],
  },
  {
    slug: "consultation", title: "Консультация", route: "/consultation", group: "Услуги", description: "Заголовки формы первичного обращения",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Первый шаг" },
      { key: "title", label: "Первая строка заголовка", defaultValue: "Начните" },
      { key: "titleAccent", label: "Выделенная строка заголовка", defaultValue: "с консультации" },
      { key: "lead", label: "Описание", defaultValue: "Познакомимся, обсудим ваш запрос и подберём направление реабилитации.", multiline: true },
      { key: "successTitle", label: "После отправки · заголовок", defaultValue: "Заявка принята" },
      { key: "successText", label: "После отправки · текст", defaultValue: "Свяжемся с вами в ближайшее время." },
      { key: "submitButton", label: "Кнопка отправки", defaultValue: "Оставить заявку" },
    ],
  },
  {
    slug: "contact", title: "Контакты", route: "/contact", group: "Информация", description: "Контактные подписи, адрес и режим работы",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Всегда на связи" },
      { key: "title", label: "Заголовок", defaultValue: "Контакты" },
      { key: "lead", label: "Описание", defaultValue: "Свяжитесь со мной удобным способом" },
      { key: "phoneLabel", label: "Подпись телефона", defaultValue: "Телефон" },
      { key: "phone", label: "Телефон", defaultValue: "+7 (926) 426-91-46" },
      { key: "emailLabel", label: "Подпись почты", defaultValue: "Почта" },
      { key: "email", label: "Почта", defaultValue: "at@body-state.ru" },
      { key: "addressLabel", label: "Подпись адреса", defaultValue: "Адрес" },
      { key: "address", label: "Адрес", defaultValue: "Хотьково, Заводская 16" },
      { key: "hoursLabel", label: "Подпись режима работы", defaultValue: "Режим работы" },
      { key: "hours", label: "Режим работы", defaultValue: "По предварительной записи" },
      { key: "button", label: "Кнопка", defaultValue: "Записаться на консультацию" },
    ],
  },
  {
    slug: "shop", title: "Магазин", route: "/shop", group: "Основные", description: "Первый экран и служебные сообщения каталога",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Витрина заботы" },
      { key: "title", label: "Заголовок", defaultValue: "Полезное для ежедневной заботы о себе" },
      { key: "lead", label: "Описание", defaultValue: "Отобранные товары для ухода, здоровья и спокойных домашних ритуалов.", multiline: true },
      { key: "emptyTitle", label: "Пустой каталог · заголовок", defaultValue: "Скоро здесь появятся товары" },
      { key: "emptyText", label: "Пустой каталог · описание", defaultValue: "Мы пока наполняем витрину" },
    ],
  },
  {
    slug: "reviews", title: "Отзывы", route: "/reviews", group: "Основные", description: "Заголовки страницы и формы отзыва",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Истории клиентов" },
      { key: "title", label: "Заголовок", defaultValue: "Отзывы" },
      { key: "lead", label: "Описание", defaultValue: "Что говорят клиенты о реабилитации" },
      { key: "empty", label: "Сообщение без отзывов", defaultValue: "Пока нет отзывов. Будьте первым!" },
      { key: "formTitle", label: "Форма · заголовок", defaultValue: "Оставить отзыв" },
      { key: "successTitle", label: "После отправки · заголовок", defaultValue: "Спасибо за отзыв!" },
      { key: "successText", label: "После отправки · описание", defaultValue: "Ваш отзыв отправлен на модерацию. После проверки он появится на странице.", multiline: true },
      { key: "submitButton", label: "Кнопка отправки", defaultValue: "Отправить отзыв" },
    ],
  },
  {
    slug: "media", title: "Медиа", route: "/media", group: "Информация", description: "Заголовок и сообщения галереи",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Результаты наших клиентов" },
      { key: "lead", label: "Описание", defaultValue: "Фото и видео до и после прохождения программ" },
      { key: "empty", label: "Сообщение без публикаций", defaultValue: "Пока нет результатов" },
    ],
  },
  {
    slug: "blog", title: "Блог", route: "/blog", group: "Информация", description: "Вводный текст и сообщение пустого блога",
    fields: [
      { key: "eyebrow", label: "Надзаголовок", defaultValue: "Блог" },
      { key: "title", label: "Заголовок", defaultValue: "Статьи и заметки" },
      { key: "lead", label: "Описание", defaultValue: "О теле, фасциях, нервной системе и бережном подходе к восстановлению.", multiline: true },
      { key: "empty", label: "Сообщение без статей", defaultValue: "Пока нет статей" },
    ],
  },
  {
    slug: "privacy", title: "Политика конфиденциальности", route: "/privacy", group: "Юридические", description: "Заголовок и полная замена юридического текста. Меняйте документ только после правовой проверки.",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Политика обработки персональных данных" },
      { key: "subtitle", label: "Редакция и пояснение", defaultValue: "Редакция от 24 августа 2026 года. Политика применяется к сайту body-state.ru и формам, размещённым на нём.", multiline: true },
      { key: "body", label: "Полная замена документа (оставьте пустым, чтобы использовать проверенный исходный текст)", defaultValue: "", multiline: true, rows: 18 },
    ],
  },
  {
    slug: "oferta", title: "Публичная оферта", route: "/oferta", group: "Юридические", description: "Заголовок и полная замена юридического текста. Меняйте документ только после правовой проверки.",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Публичная оферта" },
      { key: "subtitle", label: "Редакция и пояснение", defaultValue: "Редакция от 23 августа 2026 года. Условия дистанционной продажи товаров и оказания услуг.", multiline: true },
      { key: "body", label: "Полная замена документа (оставьте пустым, чтобы использовать проверенный исходный текст)", defaultValue: "", multiline: true, rows: 18 },
    ],
  },
  {
    slug: "personal-data-consent", title: "Согласие на обработку данных", route: "/personal-data-consent", group: "Юридические", description: "Текст согласия на обработку персональных данных.",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Согласие на обработку персональных данных" },
      { key: "subtitle", label: "Версия и пояснение", defaultValue: "Версия 2026-08-24. Согласие подтверждается отдельной отметкой в форме сайта.", multiline: true },
      { key: "body", label: "Полная замена документа (оставьте пустым для исходной версии)", defaultValue: "", multiline: true, rows: 18 },
    ],
  },
  {
    slug: "consent-publication", title: "Согласие на публикацию", route: "/consent-publication", group: "Юридические", description: "Текст согласия на распространение данных в отзыве.",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Согласие на распространение персональных данных" },
      { key: "subtitle", label: "Версия и пояснение", defaultValue: "Версия 2026-08-24. Оформляется отдельно и применяется только к публикации отзыва.", multiline: true },
      { key: "body", label: "Полная замена документа (оставьте пустым для исходной версии)", defaultValue: "", multiline: true, rows: 18 },
    ],
  },
  {
    slug: "review-rules", title: "Правила отзывов", route: "/review-rules", group: "Юридические", description: "Правила публикации, модерации и подачи жалоб.",
    fields: [
      { key: "title", label: "Заголовок", defaultValue: "Правила публикации отзывов" },
      { key: "subtitle", label: "Редакция и пояснение", defaultValue: "Редакция от 24 августа 2026 года. Правила действуют для отзывов на body-state.ru.", multiline: true },
      { key: "body", label: "Полная замена документа (оставьте пустым для исходной версии)", defaultValue: "", multiline: true, rows: 18 },
    ],
  },
];

export const managedPages = [
  { title: "О специалисте", route: "/about", adminRoute: "/admin/pages/about", group: "Информация", description: "Основной текст страницы" },
  { title: "Физическая реабилитация", route: "/bfm", adminRoute: "/admin/pages/bfm", group: "Услуги", description: "Описание и информационные карточки" },
  { title: "БРТ", route: "/brt", adminRoute: "/admin/pages/brt", group: "Услуги", description: "Описание и информационные карточки" },
  { title: "Программа", route: "/program", adminRoute: "/admin/pages/program", group: "Услуги", description: "Описание и информационные карточки" },
  { title: "Программы психологической реабилитации", route: "/psychology", adminRoute: "/admin/psychology", group: "Динамический контент", description: "Карточки, цены и тексты программ" },
  { title: "Товары магазина", route: "/shop", adminRoute: "/admin/products", group: "Динамический контент", description: "Карточки товаров, описания и цены" },
  { title: "Отзывы клиентов", route: "/reviews", adminRoute: "/admin/reviews", group: "Динамический контент", description: "Сами отзывы и модерация" },
  { title: "Публикации медиа", route: "/media", adminRoute: "/admin/media", group: "Динамический контент", description: "Фото, видео и подписи публикаций" },
] as const;

export function getEditablePage(slug: string) {
  return editablePages.find((page) => page.slug === slug);
}

export function getPageDefaults(slug: string): Record<string, string> {
  const page = getEditablePage(slug);
  return Object.fromEntries((page?.fields || []).map((field) => [field.key, field.defaultValue]));
}
