"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import AdminThemeToggle from "./AdminThemeToggle";

const sections: Array<{ prefix: string; title: string; description: string }> = [
  { prefix: "/admin/notifications", title: "Журнал отправок", description: "Проверьте, что произошло с сообщением или напоминанием клиенту" },
  { prefix: "/admin/payment-cases", title: "Проверка платежей", description: "Разберите оплаты отменённых записей и платежи с неизвестным результатом" },
  { prefix: "/admin/dashboard", title: "Рабочий день", description: "Приёмы, задачи и быстрые действия" },
  { prefix: "/admin/calendar", title: "Календарь приёмов", description: "Записи клиентов, занятость и перерывы" },
  { prefix: "/admin/bookings", title: "Записи и клиенты", description: "Найдите клиента, откройте запись и управляйте приёмом" },
  { prefix: "/admin/slots", title: "Время для записи", description: "Откройте свободное время или закройте его перерывом" },
  { prefix: "/admin/payment-links", title: "Ссылки на оплату", description: "Персональные платежи и электронные чеки" },
  { prefix: "/admin/promo-codes", title: "Промокоды", description: "Скидки на процедуры и лимиты применений" },
  { prefix: "/admin/loyalty", title: "Бонусы за посещения", description: "Награды за состоявшиеся приёмы" },
  { prefix: "/admin/orders", title: "Заказы и оплаты", description: "Покупки, оплата и доставка" },
  { prefix: "/admin/products", title: "Товары", description: "Каталог, остатки и цены" },
  { prefix: "/admin/prices", title: "Цены", description: "Стоимость услуг, программ и товаров" },
  { prefix: "/admin/psychology-rooms", title: "Онлайн-консультации", description: "Видеокомнаты для дистанционных приёмов" },
  { prefix: "/admin/psychology", title: "Программы психологии", description: "Описания психологических программ на сайте" },
  { prefix: "/admin/pages", title: "Тексты страниц", description: "Выберите страницу, измените содержимое и сохраните" },
  { prefix: "/admin/promotions", title: "Акции на сайте", description: "Предложения и условия участия для посетителей" },
  { prefix: "/admin/reviews", title: "Отзывы и жалобы", description: "Обратная связь клиентов и обращения по отзывам" },
  { prefix: "/admin/media", title: "Фото «До и после»", description: "Фотографии и описания результатов работы" },
  { prefix: "/admin/faq", title: "Ответы чат-бота", description: "База ответов. Сам чат сейчас отключён на сайте" },
  { prefix: "/admin/settings", title: "Настройки", description: "Тема публичного сайта и пароль администратора" },
];

const guidance: Record<string, { text: string; href: string; action: string }> = {
  slots: { text: "Выберите период, часы и рабочие дни. Проверьте предпросмотр и создайте окна. Перерыв закрывает пересекающееся время во всех направлениях.", href: "/admin/calendar", action: "Посмотреть занятость" },
  calendar: { text: "Здесь показаны приёмы и перерывы. Чтобы открыть время для новых записей или добавить перерыв, используйте «Время для записи».", href: "/admin/slots", action: "Настроить свободное время" },
  bookings: { text: "Найдите клиента по имени или телефону и откройте карточку. Подтверждённая запись может ожидать оплату на приёме. Посещение отмечайте после фактического приёма.", href: "/admin/calendar", action: "Открыть календарь" },
  "payment-cases": { text: "Сверьте платёж с банком, укажите результат и комментарий. Закрытие случая сохраняет решение, но не выполняет возврат денег.", href: "/admin/orders", action: "Проверить заказы" },
  "payment-links": { text: "Укажите услугу, сумму и email для чека. Для учёта посещения свяжите оплату с клиентом и приёмом. Создание ссылки само по себе не означает оплату.", href: "/admin/bookings", action: "Найти запись клиента" },
  notifications: { text: "«Принято» означает, что сервис принял сообщение, а не подтвердил доставку. Если канал не настроен, повтор не решит проблему без подключения отправщика.", href: "/admin/bookings", action: "Открыть записи" },
  promotions: { text: "Акция описывает предложение на сайте. Скидка по коду настраивается в «Промокоды», награды за приёмы — в «Бонусы за посещения».", href: "/admin/promo-codes", action: "Настроить промокод" },
  loyalty: { text: "В программе учитываются отмеченные посещения. Сама запись или оплата не заменяет отметку о состоявшемся приёме.", href: "/admin/bookings", action: "Открыть записи" },
  pages: { text: "Выберите страницу, измените поля и сохраните. Документы об образовании добавляются в редакторе страницы «Обо мне».", href: "/about", action: "Открыть страницу «Обо мне»" },
  psychology: { text: "Здесь редактируются программы для сайта. Клиентские приёмы находятся в «Записи и клиенты», стоимость — в «Цены».", href: "/admin/prices", action: "Изменить цены" },
  settings: { text: "Тема основного сайта меняется для посетителей. Кнопка темы в верхней панели меняет оформление только вашей админки.", href: "/", action: "Посмотреть сайт" },
};

export default function AdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const section = sections.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix + "/")) || sections[2];
  const help = guidance[section.prefix.split("/").pop()!];

  const logout = async () => {
    setLoggingOut(true); setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/login"); router.refresh();
    } catch { setLogoutError("Не удалось выйти. Попробуйте ещё раз."); setLoggingOut(false); }
  };

  return (
    <><header className="admin-topbar">
      <div className="min-w-0">
        <p className="admin-kicker"><Link href="/admin/dashboard">Центр управления</Link>{pathname !== section.prefix && <> / <Link href={section.prefix}>{section.title}</Link></>}</p>
        <h1>{section.title}</h1>
        <p>{section.description}</p>
      </div>
      <div className="admin-topbar-actions">
        <AdminThemeToggle />
        <Link href="/" target="_blank" rel="noopener noreferrer" aria-label="Открыть сайт в новой вкладке" className="admin-secondary-action">
          <ExternalLink className="h-4 w-4" />
          <span>Открыть сайт</span>
        </Link>
        <button type="button" disabled={loggingOut} onClick={logout} className="admin-icon-action" aria-label="Выйти из админки" title="Выйти">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
    {logoutError && <p role="alert" className="admin-route-error">{logoutError}</p>}
    {help && <details key={section.prefix} className="admin-page-help"><summary>Как работать в этом разделе</summary><p>{help.text}</p><Link href={help.href}>{help.action} →</Link></details>}
    </>
  );
}
