// Synthetic data only. No customer records, active tokens or provider credentials.
const base={name:'Анна',serviceTitle:'Физическая реабилитация',slotTime:'2026-10-22T06:30:00Z',accountUrl:'https://body-state.ru/account'};
module.exports=[
  {slug:'password-reset',kind:'reset_requested',title:'Восстановление доступа',data:{resetUrl:'https://body-state.ru/account/reset-password?token=PREVIEW-NOT-A-REAL-TOKEN'}},
  {slug:'booking-confirmed',kind:'confirmed',title:'Запись подтверждена',data:base},
  {slug:'booking-rescheduled',kind:'rescheduled',title:'Запись перенесена',data:{...base,oldTime:'2026-10-20T10:00:00Z'}},
  {slug:'booking-cancelled',kind:'cancelled',title:'Запись отменена',data:base},
  // Match actual current V1 fields: amount/payment timestamp are NOT supplied.
  {slug:'payment-confirmed',kind:'paid',title:'Оплата подтверждена',data:base},
];
