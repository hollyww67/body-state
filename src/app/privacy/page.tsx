import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Обработка и защита персональных данных",
};

export default function PrivacyPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold mb-8" style={{ color: 'var(--foreground)' }}>Политика конфиденциальности</h1>
          <div className="space-y-6 text-sm leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>1. Общие положения</h2>
            <p>1.1. Настоящая Политика разработана в соответствии с Федеральным законом РФ № 152-ФЗ «О персональных данных» и действует в отношении всей информации, которую Продавец (Танчук Алёна Васильевна, ИНН 343508662268) может получить о Пользователе во время использования им сайта https://body-state.ru.</p>
            <p>1.2. Использование сайта означает безоговорочное согласие Пользователя с настоящей Политикой.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>2. Какие данные собираются</h2>
            <p>2.1. При записи на услуги: имя, номер телефона, адрес электронной почты, Telegram-username.</p>
            <p>2.2. При оформлении заказа: имя, номер телефона, адрес электронной почты, адрес доставки.</p>
            <p>2.3. Сайт не собирает специальные категории персональных данных.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>3. Цели обработки</h2>
            <p>3.1. Оформление и исполнение заказов; запись на услуги и подтверждение записи; отправка уведомлений о статусе заказа/записи; улучшение качества обслуживания.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>4. Порядок обработки</h2>
            <p>4.1. Обработка персональных данных осуществляется с согласия Пользователя, выраженного путём заполнения форм на сайте.</p>
            <p>4.2. Данные хранятся в защищённой базе данных Supabase (PostgreSQL).</p>
            <p>4.3. Продавец не передаёт персональные данные третьим лицам.</p>
            <p>4.4. Пользователь может отозвать согласие, направив уведомление на at@body-state.ru.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>5. Меры защиты</h2>
            <p>5.1. Продавец принимает необходимые организационные и технические меры для защиты персональных данных.</p>
            <p>5.2. Передача данных между сайтом и сервером осуществляется по защищённому протоколу SSL.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>6. Права Пользователя</h2>
            <p>6.1. Пользователь имеет право получать информацию о своих данных, требовать их уточнения, блокировки или уничтожения.</p>
            <p>6.2. Запросы направляются на at@body-state.ru. Срок ответа — 10 рабочих дней.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>7. Файлы cookie</h2>
            <p>7.1. Сайт использует файлы cookie для аналитики (Umami). Данные не содержат персональной информации.</p>

            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>8. Изменение политики</h2>
            <p>8.1. Актуальная версия всегда доступна по адресу https://body-state.ru/privacy.</p>
            <p>Дата обновления: 28 мая 2026 года.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
