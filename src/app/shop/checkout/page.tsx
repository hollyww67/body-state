'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image?: string;
}

export default function CheckoutPage() {
    const router = useRouter();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({
        client_name: '',
        client_phone: '',
        address: '',
        delivery: 'self' // self | courier
    });

    useEffect(() => {
        const saved = localStorage.getItem('cart');
        if (saved) {
            try {
                setCart(JSON.parse(saved));
            } catch {
                setCart([]);
            }
        }
    }, []);

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: form.client_name,
                    client_phone: form.client_phone,
                    address: form.delivery === 'courier' ? form.address : 'Самовывоз',
                    delivery: form.delivery,
                    items: cart,
                    total: total,
                    status: 'pending',
                    payment_method: 'tbank'
                })
            });

            if (res.ok) {
                setSuccess(true);
                localStorage.removeItem('cart');
                setTimeout(() => router.push('/shop'), 3000);
            } else {
                alert('Ошибка при оформлении заказа');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ошибка при оформлении заказа');
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0 && !success) {
        return (
            <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
                <Navbar />
                <div className="pt-32 px-4 text-center">
                    <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                        Корзина пуста
                    </h1>
                    <Link 
                        href="/shop" 
                        className="text-blue-500 hover:underline"
                        style={{ color: 'var(--primary)' }}
                    >
                        Вернуться в магазин
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
            <Navbar />
            
            <section className="pt-32 pb-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <Link 
                        href="/shop/cart" 
                        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
                        style={{ color: 'var(--foreground-secondary)' }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Назад в корзину
                    </Link>

                    <h1 className="text-2xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>
                        Оформление заказа
                    </h1>

                    {success ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl shadow-sm p-8 text-center"
                            style={{ background: 'var(--card-bg)' }}
                        >
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--success-bg)' }}>
                                <CheckCircle className="w-8 h-8" style={{ color: 'var(--success)' }} />
                            </div>
                            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                Заказ оформлен!
                            </h2>
                            <p className="mb-4" style={{ color: 'var(--foreground-secondary)' }}>
                                Мы свяжемся с вами для подтверждения.
                                <br />
                                <span className="text-sm">Оплата через Т-Банк будет доступна позже.</span>
                            </p>
                            <Link 
                                href="/shop" 
                                className="hover:underline"
                                style={{ color: 'var(--primary)' }}
                            >
                                Продолжить покупки
                            </Link>
                        </motion.div>
                    ) : (
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Форма */}
                            <div className="md:col-span-2 rounded-2xl shadow-sm p-6" style={{ background: 'var(--card-bg)' }}>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                                            Имя *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.client_name}
                                            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                                            style={{ 
                                                background: 'var(--bg)',
                                                borderColor: 'var(--border)',
                                                color: 'var(--foreground)'
                                            }}
                                            placeholder="Ваше имя"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                                            Телефон *
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={form.client_phone}
                                            onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                                            style={{ 
                                                background: 'var(--bg)',
                                                borderColor: 'var(--border)',
                                                color: 'var(--foreground)'
                                            }}
                                            placeholder="+7 (___)-___-__-__"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                                            Способ получения
                                        </label>
                                        <select
                                            value={form.delivery}
                                            onChange={(e) => setForm({ ...form, delivery: e.target.value })}
                                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                                            style={{ 
                                                background: 'var(--bg)',
                                                borderColor: 'var(--border)',
                                                color: 'var(--foreground)'
                                            }}
                                        >
                                            <option value="self">Самовывоз (Хотьково)</option>
                                            <option value="courier">Доставка курьером</option>
                                        </select>
                                    </div>

                                    {form.delivery === 'courier' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                                                Адрес доставки *
                                            </label>
                                            <textarea
                                                required
                                                value={form.address}
                                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                                                style={{ 
                                                    background: 'var(--bg)',
                                                    borderColor: 'var(--border)',
                                                    color: 'var(--foreground)'
                                                }}
                                                rows={3}
                                                placeholder="Улица, дом, квартира, подъезд..."
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3 px-4 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                        style={{ background: 'var(--primary)' }}
                                    >
                                        {loading ? 'Обработка...' : 'Оформить заказ'}
                                    </button>

                                    <div className="text-center text-sm flex items-center justify-center gap-1" style={{ color: 'var(--foreground-secondary)' }}>
                                        <CreditCard className="w-4 h-4" />
                                        Оплата через Т-Банк (скоро)
                                    </div>
                                </form>
                            </div>

                            {/* Сводка */}
                            <div className="rounded-2xl shadow-sm p-6 h-fit" style={{ background: 'var(--card-bg)' }}>
                                <h2 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                                    Ваш заказ
                                </h2>
                                <div className="space-y-3 mb-4 max-h-60 overflow-auto">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex justify-between text-sm" style={{ color: 'var(--foreground)' }}>
                                            <span>{item.name} × {item.quantity}</span>
                                            <span>{item.price * item.quantity} ₽</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex justify-between font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                                        <span>Итого</span>
                                        <span>{total} ₽</span>
                                    </div>
                                </div>
                                <div className="mt-4 text-xs flex items-center gap-2" style={{ color: 'var(--foreground-secondary)' }}>
                                    <Clock className="w-3 h-3" />
                                    Оплата через Т-Банк — в ближайшее время
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
