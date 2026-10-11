"use client";

import { useRef, useState } from "react";

interface PaymentButtonProps {
  amount: number;
  orderId: string;
  description?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  items?: Array<{ productId?: string; name: string; price: number; quantity: number; bookingId?: string; bookingType?: string; serviceCode?: string }>;
  label?: string;
  className?: string;
  disabled?: boolean;
  consent: boolean;
}

export default function PaymentButton({
  amount,
  orderId,
  description = "Оплата",
  customerName,
  email,
  phone,
  address,
  items,
  label = "Оплатить",
  className,
  disabled = false,
  consent,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const attemptId = useRef<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    attemptId.current ||= `${orderId.slice(0, 80)}-${crypto.randomUUID()}`;
    try {
      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          orderId: attemptId.current,
          description,
          customerName,
          customerEmail: email,
          customerPhone: phone,
          address,
          items,
          consent,
        }),
      });

      const data = await res.json();

      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        attemptId.current = null;
        alert(data.error || "Ошибка создания платежа");
      }
    } catch {
      attemptId.current = null;
      alert("Ошибка соединения. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePay}
      disabled={disabled || loading}
      className={className || "liquid-btn group relative inline-flex items-center justify-center rounded-full text-white px-8 py-4 font-medium gap-2.5 disabled:opacity-50"}
    >
      {loading ? "Создание платежа..." : label}
    </button>
  );
}
