"use client";

import { useId, useMemo, useState } from "react";
import { BadgeCheck, Mail, MapPin, Phone, Receipt, ShieldCheck, User } from "lucide-react";
import PaymentButton from "@/components/PaymentButton";
import PersonalDataConsent from "@/components/legal/PersonalDataConsent";
import TextField from "@/components/ui/TextField";

interface OrderSummaryProps {
  total: number;
  items: Array<{ productId?: string; name: string; price: number; quantity: number }>;
  name: string;
  email: string;
  phone: string;
  address: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price);

export default function OrderSummary({ total, items, name, email, phone, address, onNameChange, onEmailChange, onPhoneChange, onAddressChange }: OrderSummaryProps) {
  const reactId = useId();
  const orderId = useMemo(() => `cart-${reactId.replace(/:/g, "")}-${Date.now()}`, [reactId]);
  const [consent, setConsent] = useState(false);
  const missing = [!name.trim() && "имя", !(email.trim() || phone.trim()) && "email или телефон", !address.trim() && "адрес доставки", !consent && "согласие"].filter(Boolean);
  const canPay = missing.length === 0;

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="ds-panel checkout-card">
        <header className="checkout-heading">
          <div><span className="ds-kicker">Оформление</span><h2>Ваш заказ</h2></div>
          <span className="checkout-icon"><Receipt /></span>
        </header>

        <div className="checkout-total-card">
          <div className="checkout-total-row"><span>Товары</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)} шт.</strong></div>
          <div className="checkout-total-row"><span>Доставка</span><strong className="text-[var(--primary)]">Бесплатно</strong></div>
          <div className="checkout-total"><span>К оплате</span><strong>{formatPrice(total)} <small>₽</small></strong></div>
        </div>

        <div className="checkout-section">
          <div className="checkout-section-title"><span>1</span><div><h3>Получатель</h3><p>Для связи и электронного чека</p></div></div>
          <div className="space-y-4">
            <TextField label="Имя и фамилия" icon={<User />} value={name} onChange={(event) => onNameChange(event.target.value)} autoComplete="name" required />
            <TextField label="Email" icon={<Mail />} type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} autoComplete="email" optional hint="Укажите email или телефон — достаточно одного контакта" />
            <TextField label="Телефон" icon={<Phone />} type="tel" value={phone} onChange={(event) => onPhoneChange(event.target.value)} autoComplete="tel" inputMode="tel" optional />
          </div>
        </div>

        <div className="checkout-section">
          <div className="checkout-section-title"><span>2</span><div><h3>Получение</h3><p>Куда передать заказ</p></div></div>
          <TextField label="Адрес доставки" icon={<MapPin />} value={address} onChange={(event) => onAddressChange(event.target.value)} autoComplete="street-address" placeholder="Например: Хотьково, Заводская, 16" required />
        </div>

        <div className="checkout-section">
          <div className="checkout-section-title"><span>3</span><div><h3>Подтверждение</h3><p>Проверьте данные перед оплатой</p></div></div>
          <PersonalDataConsent id="order-consent" checked={consent} onChange={setConsent} />
        </div>

        {!canPay && <p className="ds-alert" role="status">Осталось заполнить: {missing.join(", ")}.</p>}

        <div className="mt-5 active:scale-[.985] transition-transform">
          <PaymentButton amount={total} orderId={orderId} description="Оплата заказа" customerName={name} email={email} phone={phone} address={address} items={items} label={`Оплатить ${formatPrice(total)} ₽`} className="ds-primary-button w-full" disabled={!canPay} consent={consent} />
        </div>

        <div className="checkout-trust" aria-label="Безопасность оплаты">
          <span><ShieldCheck /> Защищённая оплата</span>
          <span><BadgeCheck /> Электронный чек</span>
        </div>
      </div>
    </aside>
  );
}
