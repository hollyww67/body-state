// Здесь будет интеграция с Т-Банком
// Пока возвращаем заглушку

export interface TBankPayment {
    id: string;
    amount: number;
    description: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
}

export async function createPayment(orderId: string, amount: number, description: string): Promise<TBankPayment> {
    // TODO: Заменить на реальный API Т-Банка
    console.log('Payment for order:', orderId, amount, description);
    
    return {
        id: `tbank_${Date.now()}`,
        amount,
        description,
        status: 'pending'
    };
}

export async function checkPaymentStatus(paymentId: string): Promise<TBankPayment> {
    // TODO: Заменить на реальный API Т-Банка
    return {
        id: paymentId,
        amount: 0,
        description: '',
        status: 'pending'
    };
}
