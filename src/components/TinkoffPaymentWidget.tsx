"use client";

import { useEffect, useRef, useState } from "react";

interface TinkoffPaymentWidgetProps {
  amount: number;
  orderId: string;
  description: string;
  email?: string;
  phone?: string;
  items?: Array<{ name: string; price: number; quantity: number }>;
  onPaymentSuccess?: () => void;
  onPaymentFail?: () => void;
}

declare global {
  interface Window {
    PaymentIntegration: any;
    onPaymentIntegrationLoad?: () => void;
  }
}

export default function TinkoffPaymentWidget({
  amount,
  orderId,
  description,
  email,
  phone,
  items,
}: TinkoffPaymentWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.PaymentIntegration) {
          resolve();
          return;
        }

        const existing = document.querySelector(
          'script[src="https://integrationjs.tbank.ru/integration.js"]'
        );
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Script load error')));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://integrationjs.tbank.ru/integration.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Script load error'));
        document.body.appendChild(script);
      });
    };

    const initWidget = async () => {
      try {
        await loadScript();

        const terminalKey = process.env.NEXT_PUBLIC_TINKOFF_TERMINAL_KEY;
        if (!terminalKey) {
          throw new Error('NEXT_PUBLIC_TINKOFF_TERMINAL_KEY не задан');
        }

        const initConfig = {
          terminalKey,
          product: 'eacq',
          features: {
            payment: {},
          },
        };

        const integration = await window.PaymentIntegration.init(initConfig);

        // Создаём интеграцию кнопок оплаты
        const paymentIntegration = await integration.payments.create(
          'main-integration',
          {}
        );

        // Монтируем в контейнер (он уже в DOM)
        if (!containerRef.current) {
          throw new Error('Контейнер не найден');
        }
        await paymentIntegration.mount(containerRef.current);

        // Callback при нажатии на способ оплаты
        await integration.payments.setPaymentStartCallback(async () => {
          const response = await fetch('/api/payment/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount,
              orderId,
              description,
              customerName: 'Покупатель',
              customerEmail: email,
              customerPhone: phone,
              items,
            }),
          });

          const data = await response.json();
          if (!data.success || !data.paymentUrl) {
            throw new Error(data.error || 'Не удалось создать платёж');
          }

          return data.paymentUrl;
        });

        // Устанавливаем виды оплаты (T-Pay, СБП)
        const widgetTypes = ['tpay', 'sbp'];
        await paymentIntegration.updateWidgetTypes(widgetTypes);

        if (isMounted) setLoading(false);
      } catch (err: any) {
        console.error('[TinkoffPaymentWidget] Ошибка инициализации:', err);
        if (isMounted) {
          setError(err.message || 'Ошибка загрузки виджета');
          setLoading(false);
        }
      }
    };

    initWidget();

    return () => {
      isMounted = false;
    };
  }, [amount, orderId, description, email, phone, items]);

  return (
    <div className="relative">
      {/* Контейнер всегда рендерится, даже когда loading или error */}
      <div ref={containerRef} id="paymentContainer" className="min-h-[60px]" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Загрузка способов оплаты...
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-center text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
