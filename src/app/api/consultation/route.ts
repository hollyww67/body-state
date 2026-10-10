import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CONSENT_VERSION, hasPersonalDataConsent } from '@/lib/legal';
import { cleanMultiline, cleanText, enforceRateLimit, normalizePhone, readJsonObject } from '@/lib/request';
import { getAccountSession } from '@/lib/account-auth';


async function sendTelegramNotification(id: string | number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) return;
  
  const text = `📋 *Новая заявка на консультацию*\n\nНомер: ${String(id).slice(0, 8)}\nДетали доступны в защищённой админке.`;
  
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
    const limited = await enforceRateLimit(request, 'consultation', 5, 60 * 60);
    if (limited) return limited;
    const body = await readJsonObject(request);
    
    // Поддержка обоих форматов: {name, phone, message} и {client_name, client_phone, notes}
    const name = cleanText(body.name || body.client_name, 120);
    const phone = normalizePhone(body.phone || body.client_phone);
    const message = cleanMultiline(body.message || body.notes, 1500);
    const serviceType = cleanText(body.service_type, 40) || 'consultation';
    const session = await getAccountSession(request);
    if (!hasPersonalDataConsent(body.consent)) return NextResponse.json({ error: 'Необходимо согласие на обработку персональных данных' }, { status: 400 });
    
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Имя и телефон обязательны' },
        { status: 400 }
      );
    }

    // Сохраняем в PostgreSQL
    const { data, error } = await db
      .from('consultation_enrollments')
      .insert([{
        name: name,
        phone: phone,
        message: message,
        source: 'contact_page',
        status: 'new',
        created_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
        consent_at: new Date().toISOString(),
        service_type: serviceType,
        account_user_id: session?.userId || null,
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('PostgreSQL error:', error);
      return NextResponse.json(
        { error: 'Ошибка сохранения' },
        { status: 500 }
      );
    }

    // Отправляем в Telegram
    await sendTelegramNotification(data.id);

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 'Запрос слишком большой' : 'Некорректный запрос' },
      { status: error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400 }
    );
  }
}
