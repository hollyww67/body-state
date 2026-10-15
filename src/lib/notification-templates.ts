export type EmailTemplate = { subject: string; html: string; text: string };
type BookingEvent = 'created' | 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder';
type BookingEmail = {
  kind: BookingEvent;
  name: string;
  service: string;
  startsAt: string;
  previousStartsAt?: string;
};
const site = 'https://body-state.ru';
const escape = (value: string) => value.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const date = (input: unknown) => {
  const value = input instanceof Date && Number.isFinite(input.getTime()) ? input.toISOString() : input;
  // Require an explicit offset: naive timestamps depend on the worker timezone.
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('invalid_notification_date');
  }
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date(value)) + ' (Москва)';
};
type DetailCard = { title: string; rows: [string, string][] };
const autoFooter = 'Письмо отправлено автоматически. Пожалуйста, не отвечайте на него.';
const bookingHelp = 'Если вы не узнаёте эту запись, обратитесь за помощью через личный кабинет.';
function bookingCard(service: string, input: unknown, title = 'Ваша запись'): DetailCard {
  date(input); // Keep the same explicit-offset validation for every displayed date.
  const value = new Date(input instanceof Date ? input.getTime() : input as string);
  return { title, rows: [
    ['Услуга', service],
    ['Дата', new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long' }).format(value)],
    ['Время', new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', timeStyle: 'short' }).format(value) + ' (Москва)'],
  ] };
}
function render(subject: string, lines: string[], label = 'Мои записи', url = `${site}/account`, cards: DetailCard[] = [], footerNote = ''): EmailTemplate {
  const link = new URL(url);
  if (link.origin !== site || link.username || link.password) throw new Error('invalid_notification_url');
  const safeUrl = escape(link.href);
  return {
    subject: `Body State — ${subject}`,
    text: ['BODY STATE', subject, ...lines, ...cards.map(card => [card.title, ...card.rows.map(([key, value]) => `${key}: ${value}`)].join('\n')), `${label}: ${link.href}`, ...(footerNote?[footerNote]:[]), autoFooter, 'BODY STATE', site].join('\n\n'),
    html: `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;width:100%;background:#F6F5F2;color:#111827;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F6F5F2" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;table-layout:fixed;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:16px">
<tr><td style="padding:28px 24px;border-bottom:1px solid #E5E7EB"><a href="${site}" style="color:#111827;text-decoration:none"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="76" valign="middle"><img src="${site}/admin-icons/192.png" alt="Body State" width="64" height="64" style="display:block;width:64px;height:64px;border:0"></td><td valign="middle" style="font-size:18px;line-height:24px;letter-spacing:3px;font-weight:bold;color:#111827">BODY STATE</td></tr></table></a></td></tr>
<tr><td style="padding:32px 24px"><p style="margin:0 0 12px;color:#0F766E;font-size:12px;line-height:18px;letter-spacing:2px">ЛИЧНЫЙ КАБИНЕТ</p><h1 style="margin:0 0 24px;font-size:28px;line-height:36px;font-weight:600;overflow-wrap:anywhere">${escape(subject)}</h1>
${lines.map(line => `<p style="margin:0 0 16px;font-size:16px;line-height:26px;overflow-wrap:anywhere;word-wrap:break-word">${escape(line)}</p>`).join('')}
${cards.map(card => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F6F5F2" style="width:100%;table-layout:fixed;border:1px solid #E5E7EB;border-radius:12px;margin:0 0 16px"><tr><td style="padding:20px"><h2 style="margin:0 0 16px;font-size:17px;line-height:24px;color:#0F766E">${escape(card.title)}</h2>${card.rows.map(([key, value]) => `<p style="margin:0 0 12px;font-size:12px;line-height:18px;color:#4B5563">${escape(key)}<br><span style="font-size:16px;line-height:26px;color:#111827;overflow-wrap:anywhere;word-wrap:break-word">${escape(value)}</span></p>`).join('')}</td></tr></table>`).join('')}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td align="center" bgcolor="#0F766E" style="border-radius:8px;mso-padding-alt:16px 24px"><a href="${safeUrl}" style="display:inline-block;padding:16px 24px;color:#FFFFFF;font-size:16px;line-height:24px;font-weight:bold;text-align:center;text-decoration:none;border-radius:8px;mso-padding-alt:0">${escape(label)}</a></td></tr></table>
<p style="margin:0;font-size:12px;line-height:20px;color:#4B5563">Если кнопка не открывается, перейдите по ссылке:<br><a href="${safeUrl}" style="color:#0F766E;word-break:break-all;overflow-wrap:anywhere">${safeUrl}</a></p></td></tr>
<tr><td style="padding:24px;border-top:1px solid #E5E7EB">${footerNote?`<p style="margin:0 0 12px;font-size:12px;line-height:20px;color:#4B5563">${escape(footerNote)}</p>`:''}<p style="margin:0 0 12px;font-size:12px;line-height:20px;color:#4B5563">${autoFooter}</p><p style="margin:0 0 4px;font-size:12px;line-height:20px;letter-spacing:2px;color:#111827">BODY STATE</p><a href="${site}" style="font-size:12px;line-height:20px;color:#0F766E;text-decoration:underline">body-state.ru</a></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
// Callers supply only a public service title, never clinical notes or diagnoses.
export function bookingEmailTemplate(input: BookingEmail): EmailTemplate {
  const titles: Record<BookingEvent, string> = {
    created: 'Заявка на запись получена', confirmed: 'Запись подтверждена',
    rescheduled: 'Запись перенесена', cancelled: 'Запись отменена', reminder: 'Напоминание о записи',
  };
  const lines = [`Здравствуйте, ${input.name}!`];
  const cards = [bookingCard(input.service, input.startsAt, input.kind === 'rescheduled' ? 'Новая запись' : 'Ваша запись')];
  if (input.kind === 'rescheduled') {
    if (!input.previousStartsAt) throw new Error('missing_previous_notification_date');
    cards.unshift(bookingCard(input.service, input.previousStartsAt, 'Прежняя запись'));
  }
  return render(titles[input.kind], lines, 'Мои записи', `${site}/account`, cards, bookingHelp);
}
export function passwordResetEmailTemplate(resetUrl: string): EmailTemplate {
  return render('Восстановление доступа', [
    'Чтобы восстановить доступ к личному кабинету, сбросьте пароль по одноразовой ссылке.',
    'Если вы не запрашивали восстановление доступа, проигнорируйте это письмо.',
  ], 'Сбросить пароль', resetUrl, [{title:'Срок действия ссылки',rows:[['30 минут с момента запроса','Если срок истёк, запросите новую ссылку на странице входа.']]}]);
}
export function passwordChangedEmailTemplate(): EmailTemplate {
  return render('Пароль изменён', ['Пароль вашего аккаунта был изменён.',
    'Если это были не вы, обратитесь в поддержку через сайт.'], 'Открыть сайт', site);
}
// Invoke only after durable settlement, not payment initialization.
export function paymentConfirmedEmailTemplate(name: string): EmailTemplate {
  return render('Оплата подтверждена', [`Здравствуйте, ${name}!`,
    'Информация об оплате сохранена в системе Body State. Подробности доступны в личном кабинете.',
    'Это сервисное уведомление, а не фискальный чек.']);
}

export type NotificationTemplateKind = 'created' | 'confirmed' | 'rescheduled' | 'cancelled' |
  'paid' | 'reminder_24h' | 'reminder_2h' | 'reset_requested' | 'password_changed' | 'delivery_alert';

export function notificationTemplate(kind: NotificationTemplateKind, data: Record<string, unknown>): EmailTemplate {
  const value = (key: string, fallback = '') => typeof data[key] === 'string' ? data[key] as string : fallback;
  if (kind === 'reset_requested') return passwordResetEmailTemplate(value('resetUrl'));
  if (kind === 'password_changed') return passwordChangedEmailTemplate();
  const accountUrl = value('accountUrl', `${site}/account`);
  if (kind === 'delivery_alert') {
    const title='Требуется проверка уведомлений';
    const message='Достигнут порог ошибок отправки. Проверьте состояние уведомлений в административном кабинете.';
    const result=render(title,[message],'Открыть кабинет',accountUrl);
    // This plain-text branch is also consumed by MAX admin alerts. Preserve its
    // previous exact payload: email presentation work must not change MAX.
    return {...result,text:['Body State',title,message,`Открыть кабинет: ${new URL(accountUrl).href}`,site].join('\n\n')};
  }
  if (kind === 'paid') {
    const rows: [string, string][] = [];
    if (value('serviceTitle')) rows.push(['Услуга', value('serviceTitle')]);
    // Optional future data only: current core supplies neither amount nor paidAt.
    // amount is a finite nonnegative number in rubles, never a coerced string.
    if (typeof data.amount === 'number' && Number.isFinite(data.amount) && data.amount >= 0) {
      rows.push(['Сумма', new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(data.amount)]);
    }
    if (typeof data.paidAt === 'string' || data.paidAt instanceof Date) rows.push(['Дата оплаты', date(data.paidAt)]);
    return render('Оплата подтверждена', [
    `Здравствуйте, ${value('name', 'клиент')}!`, 'Информация об оплате сохранена в системе Body State. Подробности доступны в личном кабинете.',
    'Это сервисное уведомление, а не фискальный чек.',
  ], 'Открыть кабинет', accountUrl, rows.length ? [{ title: 'Информация об оплате', rows }] : []);
  }
  const titles: Partial<Record<NotificationTemplateKind, string>> = {
    created: 'Заявка на запись получена', confirmed: 'Запись подтверждена',
    rescheduled: 'Запись перенесена', cancelled: 'Запись отменена',
    reminder_24h: 'Напоминание: запись через 24 часа', reminder_2h: 'Напоминание: запись через 2 часа',
  };
  const title = titles[kind];
  if (!title) throw new Error('invalid_notification_kind');
  const descriptions:Partial<Record<NotificationTemplateKind,string>>={
    confirmed:'Всё готово. Сохранили детали вашего приёма ниже.',
    rescheduled:'Время приёма изменилось. Ниже — прежняя и новая запись.',
    cancelled:'Запись отменена. Вы можете выбрать другое удобное время на сайте.',
  };
  const lines = [`Здравствуйте, ${value('name', 'клиент')}!`,...(descriptions[kind]?[descriptions[kind]!]:[])];
  const service = value('serviceTitle', 'Приём');
  const cards = [bookingCard(service, data.slotTime, kind === 'rescheduled' ? 'Новая запись' : 'Ваша запись')];
  if (kind === 'rescheduled') cards.unshift(bookingCard(service, data.oldTime, 'Прежняя запись'));
  const cta=kind==='confirmed'?'Открыть мои записи':kind==='rescheduled'?'Посмотреть запись':kind==='cancelled'?'Открыть кабинет':'Мои записи';
  return render(title, lines, cta, accountUrl, cards, bookingHelp);
}
