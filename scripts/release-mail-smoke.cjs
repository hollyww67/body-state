// Send a single operational test to the owner's configured reply mailbox.
const nodemailer = require('nodemailer');
(async () => {
  if (process.env.EMAIL_REPLY_TO !== 'admin@body-state.ru') throw new Error('Unexpected recipient; refusing to send');
  const port=Number(process.env.SMTP_PORT||587);
  const secure=process.env.SMTP_SECURE==='true'||port===465;
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure,requireTLS:!secure,
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:15000});
  await transport.verify();
  const result=await transport.sendMail({from:{name:process.env.EMAIL_FROM_NAME||'Body State',address:process.env.EMAIL_FROM},replyTo:process.env.EMAIL_REPLY_TO,
    to:process.env.EMAIL_REPLY_TO,subject:'Body State — проверка почты после аудита 20.09.2026',
    text:'Техническая проверка отправки писем с сайта. Это тестовое сообщение, отвечать на него не требуется. Клиентские записи и платежи не создавались.'});
  console.log(JSON.stringify({smtpVerified:true,accepted:result.accepted,rejected:result.rejected,messageId:result.messageId}));
  transport.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
