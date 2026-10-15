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
function render(subject: string, lines: string[], label = 'Мои записи', url = `${site}/account`): EmailTemplate {
  const link = new URL(url);
  if (link.origin !== site || link.username || link.password) throw new Error('invalid_notification_url');
  const safeUrl = escape(link.href);
  return {
    subject: `Body State — ${subject}`,
    text: ['Body State', subject, ...lines, `${label}: ${link.href}`, site].join('\n\n'),
    html: `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f5f2;color:#24332c;font-family:Arial,sans-serif"><main style="max-width:560px;margin:24px auto;padding:24px;background:#fff;border-radius:16px"><a href="${site}"><img src="${site}/logo.png" alt="Body State" width="64" height="64" style="display:block;border:0"></a><p style="letter-spacing:2px">BODY STATE</p><h1 style="font-size:24px;line-height:1.3">${escape(subject)}</h1>${lines.map(line => `<p style="font-size:16px;line-height:1.6;overflow-wrap:anywhere">${escape(line)}</p>`).join('')}<a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#24332c;color:#fff;border-radius:8px;text-decoration:none">${escape(label)}</a><p style="font-size:12px;line-height:1.5">Сервисное уведомление Body State. <a href="${site}">body-state.ru</a></p></main></body></html>`,
  };
}
// Callers supply only a public service title, never clinical notes or diagnoses.
export function bookingEmailTemplate(input: BookingEmail): EmailTemplate {
  const titles: Record<BookingEvent, string> = {
    created: 'Заявка на запись получена', confirmed: 'Запись подтверждена',
    rescheduled: 'Запись перенесена', cancelled: 'Запись отменена', reminder: 'Напоминание о записи',
  };
  const lines = [`Здравствуйте, ${input.name}!`, `Услуга: ${input.service}`,
    `Дата и время: ${date(input.startsAt)}`, `Статус: ${titles[input.kind]}`];
  if (input.kind === 'rescheduled') {
    if (!input.previousStartsAt) throw new Error('missing_previous_notification_date');
    lines.push(`Прежняя дата и время: ${date(input.previousStartsAt)}`);
  }
  return render(titles[input.kind], lines);
}
export function passwordResetEmailTemplate(resetUrl: string): EmailTemplate {
  return render('Восстановление доступа', [
    'Чтобы изменить пароль, перейдите по одноразовой ссылке. Срок её действия указан на странице восстановления.',
    'Если вы не запрашивали восстановление доступа, проигнорируйте это письмо.',
  ], 'Изменить пароль', resetUrl);
}
export function passwordChangedEmailTemplate(): EmailTemplate {
  return render('Пароль изменён', ['Пароль вашего аккаунта был изменён.',
    'Если это были не вы, обратитесь в поддержку через сайт.'], 'Открыть сайт', site);
}
// Invoke only after durable settlement, not payment initialization.
export function paymentConfirmedEmailTemplate(name: string): EmailTemplate {
  return render('Оплата подтверждена', [`Здравствуйте, ${name}!`,
    'Оплата получена. Информация доступна в личном кабинете.',
    'Это сервисное уведомление, а не фискальный чек. Чек предоставляется отдельно.']);
}

export type NotificationTemplateKind = 'created' | 'confirmed' | 'rescheduled' | 'cancelled' |
  'paid' | 'reminder_24h' | 'reminder_2h' | 'reset_requested' | 'password_changed' | 'delivery_alert';

export function notificationTemplate(kind: NotificationTemplateKind, data: Record<string, unknown>): EmailTemplate {
  const value = (key: string, fallback = '') => typeof data[key] === 'string' ? data[key] as string : fallback;
  if (kind === 'reset_requested') return passwordResetEmailTemplate(value('resetUrl'));
  if (kind === 'password_changed') return passwordChangedEmailTemplate();
  const accountUrl = value('accountUrl', `${site}/account`);
  if (kind === 'delivery_alert') return render('Требуется проверка уведомлений', [
    'Достигнут порог ошибок отправки. Проверьте состояние уведомлений в административном кабинете.',
  ], 'Открыть кабинет', accountUrl);
  if (kind === 'paid') return render('Оплата подтверждена', [
    `Здравствуйте, ${value('name', 'клиент')}!`, 'Оплата получена. Информация доступна в личном кабинете.',
    'Это сервисное уведомление, а не фискальный чек. Чек предоставляется отдельно.',
  ], 'Мои записи', accountUrl);
  const titles: Partial<Record<NotificationTemplateKind, string>> = {
    created: 'Заявка на запись получена', confirmed: 'Запись подтверждена',
    rescheduled: 'Запись перенесена', cancelled: 'Запись отменена',
    reminder_24h: 'Напоминание: запись через 24 часа', reminder_2h: 'Напоминание: запись через 2 часа',
  };
  const title = titles[kind];
  if (!title) throw new Error('invalid_notification_kind');
  const lines = [`Здравствуйте, ${value('name', 'клиент')}!`,
    `Услуга: ${value('serviceTitle', 'Приём')}`, `Дата и время: ${date(data.slotTime)}`,
    `Статус: ${title}`];
  if (kind === 'rescheduled') lines.push(`Прежняя дата и время: ${date(data.oldTime)}`);
  return render(title, lines, 'Мои записи', accountUrl);
}
