import { EMAIL_SITE as site, safeEmailUrl, EmailLayout, EmailHero, AppointmentDetails, EmailButton, EmailNotice, emailContactText, type EmailDetailCard } from '@/lib/email-components';
export type EmailTemplate = { subject:string; html:string; text:string };
type BookingEvent='created'|'confirmed'|'rescheduled'|'cancelled'|'reminder';
type BookingEmail={kind:BookingEvent;name:string;service:string;startsAt:string;previousStartsAt?:string;durationMinutes?:number;address?:string};
const date=(input:unknown)=>{
  const value=input instanceof Date&&Number.isFinite(input.getTime())?input.toISOString():input;
  if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/i.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('invalid_notification_date');
  return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'short'}).format(new Date(value))+' (Москва)';
};
const autoFooter='Письмо отправлено автоматически. Пожалуйста, не отвечайте на него.';
const bookingHelp='Если вы не узнаёте эту запись, обратитесь за помощью через личный кабинет.';
function bookingCard(service:string,input:unknown,title='Детали вашей записи',duration?:unknown,address?:unknown):EmailDetailCard {
  const rows:[string,string][]=[['Услуга',service],['Дата и время',date(input)]];
  if(typeof duration==='number'&&Number.isInteger(duration)&&duration>0&&duration<=1440)rows.push(['Продолжительность',`${duration} минут`]);
  if(typeof address==='string'&&address.trim())rows.push(['Адрес',address.trim()]);
  return {title,rows};
}
function render(subject:string,lines:string[],label='Мои записи',url=`${site}/account`,cards:EmailDetailCard[]=[],footerNote=''):EmailTemplate {
  const link=safeEmailUrl(url);
  const heading=subject==='Запись подтверждена'?'Вы успешно записаны':subject;
  const copy=subject==='Запись подтверждена'?[lines[0],'Спасибо за доверие. Мы будем ждать вас в назначенное время.']:lines;
  return {subject:`Body State — ${subject}`,
    text:['BODY STATE',subject,...copy,...cards.map(c=>[c.title,...c.rows.map(([k,v])=>`${k}: ${v}`)].join('\n')),`${label}: ${link}`,...(footerNote?[footerNote]:[]),emailContactText(),autoFooter,'BODY STATE',site].join('\n\n'),
    html:EmailLayout(subject,EmailHero(heading,copy)+cards.map(AppointmentDetails).join('')+EmailButton(label,link)+EmailNotice(footerNote)),
  };
}
// Only public service titles; never clinical notes or diagnoses.
export function bookingEmailTemplate(input:BookingEmail):EmailTemplate {
  const titles:Record<BookingEvent,string>={created:'Заявка на запись получена',confirmed:'Запись подтверждена',rescheduled:'Запись перенесена',cancelled:'Запись отменена',reminder:'Напоминание о записи'};
  const cards=[bookingCard(input.service,input.startsAt,input.kind==='rescheduled'?'Новая запись':'Детали вашей записи',input.durationMinutes,input.address)];
  if(input.kind==='rescheduled'){
    if(!input.previousStartsAt)throw new Error('missing_previous_notification_date');
    cards.unshift(bookingCard(input.service,input.previousStartsAt,'Прежняя запись'));
  }
  return render(titles[input.kind],[`Здравствуйте, ${input.name}!`],input.kind==='confirmed'?'Открыть запись':'Мои записи',`${site}/account`,cards,bookingHelp);
}
export function passwordResetEmailTemplate(resetUrl:string):EmailTemplate {
  return render('Восстановление доступа',['Чтобы восстановить доступ к личному кабинету, сбросьте пароль по одноразовой ссылке.','Если вы не запрашивали восстановление доступа, проигнорируйте это письмо.'],'Сбросить пароль',resetUrl,[{title:'Срок действия ссылки',rows:[['30 минут с момента запроса','Если срок истёк, запросите новую ссылку на странице входа.']]}]);
}
export function passwordChangedEmailTemplate():EmailTemplate {
  return render('Пароль изменён',['Пароль вашего аккаунта был изменён.','Если это были не вы, обратитесь в поддержку через сайт.'],'Открыть сайт',site);
}
export function accountCreatedEmailTemplate(name:string):EmailTemplate {
  return render('Личный кабинет создан',[`Здравствуйте, ${name}!`,'Ваш личный кабинет готов. Для входа используйте e-mail, указанный при регистрации.','Если понадобится новый пароль, воспользуйтесь ссылкой «Забыли пароль?» на странице входа.'],'Открыть кабинет');
}
// Invoke only after durable settlement, not payment initialization.
export function paymentConfirmedEmailTemplate(name:string):EmailTemplate {
  return render('Оплата подтверждена',[`Здравствуйте, ${name}!`,'Информация об оплате сохранена в системе Body State. Подробности доступны в личном кабинете.','Это сервисное уведомление, а не фискальный чек.']);
}
export type NotificationTemplateKind='created'|'confirmed'|'rescheduled'|'cancelled'|'paid'|'reminder_24h'|'reminder_2h'|'reset_requested'|'password_changed'|'delivery_alert';
export function notificationTemplate(kind:NotificationTemplateKind,data:Record<string,unknown>):EmailTemplate {
  const value=(key:string,fallback='')=>typeof data[key]==='string'?data[key] as string:fallback;
  if(kind==='reset_requested')return passwordResetEmailTemplate(value('resetUrl'));
  if(kind==='password_changed')return passwordChangedEmailTemplate();
  const accountUrl=value('accountUrl',`${site}/account`);
  if(kind==='delivery_alert'){
    const title='Требуется проверка уведомлений',message='Достигнут порог ошибок отправки. Проверьте состояние уведомлений в административном кабинете.';
    const result=render(title,[message],'Открыть кабинет',accountUrl);
    // Existing MAX admin payload is byte-identical.
    return {...result,text:['Body State',title,message,`Открыть кабинет: ${new URL(accountUrl).href}`,site].join('\n\n')};
  }
  if(kind==='paid'){
    const rows:[string,string][]=[];
    if(value('serviceTitle'))rows.push(['Услуга',value('serviceTitle')]);
    if(typeof data.amount==='number'&&Number.isFinite(data.amount)&&data.amount>=0)rows.push(['Сумма',new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(data.amount)]);
    if(typeof data.paidAt==='string'||data.paidAt instanceof Date)rows.push(['Дата оплаты',date(data.paidAt)]);
    return render('Оплата подтверждена',[`Здравствуйте, ${value('name','клиент')}!`,'Информация об оплате сохранена в системе Body State. Подробности доступны в личном кабинете.','Это сервисное уведомление, а не фискальный чек.'],'Открыть кабинет',accountUrl,rows.length?[{title:'Информация об оплате',rows}]:[]);
  }
  const titles:Partial<Record<NotificationTemplateKind,string>>={created:'Заявка на запись получена',confirmed:'Запись подтверждена',rescheduled:'Запись перенесена',cancelled:'Запись отменена',reminder_24h:'Напоминание: запись через 24 часа',reminder_2h:'Напоминание: запись через 2 часа'};
  const title=titles[kind];if(!title)throw new Error('invalid_notification_kind');
  const descriptions:Partial<Record<NotificationTemplateKind,string>>={confirmed:'Спасибо за доверие. Мы будем ждать вас в назначенное время.',rescheduled:'Время приёма изменилось. Ниже — прежняя и новая запись.',cancelled:'Запись отменена. Вы можете выбрать другое удобное время на сайте.'};
  const lines=[`Здравствуйте, ${value('name','клиент')}!`,...(descriptions[kind]?[descriptions[kind]!]:[])];
  const service=value('serviceTitle','Приём');
  const cards=[bookingCard(service,data.slotTime,kind==='rescheduled'?'Новая запись':'Детали вашей записи',data.durationMinutes,data.address)];
  if(kind==='rescheduled')cards.unshift(bookingCard(service,data.oldTime,'Прежняя запись'));
  const cta=kind==='confirmed'?'Открыть запись':kind==='rescheduled'?'Посмотреть запись':kind==='cancelled'?'Открыть кабинет':'Мои записи';
  return render(title,lines,cta,accountUrl,cards,bookingHelp);
}
