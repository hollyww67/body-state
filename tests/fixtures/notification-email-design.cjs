// Synthetic data only. No customer records, active tokens or provider credentials.
const base={name:'Захар',serviceTitle:'Физическая реабилитация',slotTime:'2026-10-20T11:00:00Z',durationMinutes:90,address:'Хотьково, Заводская 16',accountUrl:'https://body-state.ru/account'};
module.exports=[
  {slug:'password-reset',kind:'reset_requested',title:'Восстановление доступа',data:{resetUrl:'https://body-state.ru/account/reset-password?token=PREVIEW-NOT-A-REAL-TOKEN'}},
  {slug:'booking-confirmed',kind:'confirmed',title:'Запись подтверждена',data:base},
  {slug:'booking-rescheduled',kind:'rescheduled',title:'Запись перенесена',data:{...base,oldTime:'2026-10-20T10:00:00Z'}},
  {slug:'booking-cancelled',kind:'cancelled',title:'Запись отменена',data:base},
  // Match actual current V1 fields: amount/payment timestamp are NOT supplied.
  {slug:'payment-confirmed',kind:'paid',title:'Оплата подтверждена',data:base},
  {slug:'booking-created',kind:'created',title:'Заявка на запись получена',data:base},
  {slug:'reminder-24h',kind:'reminder_24h',title:'Напоминание: запись через 24 часа',data:base},
  {slug:'reminder-2h',kind:'reminder_2h',title:'Напоминание: запись через 2 часа',data:base},
  {slug:'password-changed',kind:'password_changed',title:'Пароль изменён',data:{}},
  {slug:'delivery-alert',kind:'delivery_alert',title:'Требуется проверка уведомлений',data:{accountUrl:'https://body-state.ru/admin/notifications'}},
  {slug:'booking-long',kind:'confirmed',title:'Запись подтверждена',data:{...base,name:'Александра-Анастасия Константинопольская',serviceTitle:'Индивидуальная программа физической реабилитации и восстановления подвижности с подробной консультацией'}},
  {slug:'account-created',kind:'welcome',title:'Личный кабинет создан',data:{name:'Захар'}},
];
