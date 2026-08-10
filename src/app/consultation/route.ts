import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramNotification(name: string, phone: string, notes?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) return;
  
  const text = `📋 *Новая заявка на консультацию*\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}\n💬 Направление: ${notes || '—'}`;
  
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (error) {
    console.error('Telegram error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Поддержка обоих форматов: {name, phone, message} и {client_name, client_phone, notes}
    const name = body.name || body.client_name;
    const phone = body.phone || body.client_phone;
    const message = body.message || body.notes || '';
    
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Имя и телефон обязательны' },
        { status: 400 }
      );
    }

    // Сохраняем в Supabase
    const { data, error } = await supabase
      .from('consultation_enrollments')
      .insert([{
        name: name,
        phone: phone,
        message: message,
        source: 'contact_page',
        status: 'new',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Ошибка сохранения' },
        { status: 500 }
      );
    }

    // Отправляем в Telegram
    await sendTelegramNotification(name, phone, message);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}
