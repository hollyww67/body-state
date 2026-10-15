const errors = [];
const value = (name) => String(process.env[name] || "").trim();
const requireValue = (name, min = 1) => {
  const current = value(name);
  if (current.length < min || /replace_with|example\.ru|yourdomain/i.test(current)) errors.push(`${name} is missing or uses a placeholder`);
  return current;
};

if (!value("DATABASE_URL")) requireValue("POSTGRES_PASSWORD", 24);
if (!value("REDIS_URL")) requireValue("REDIS_PASSWORD", 24);
requireValue("ADMIN_USERNAME", 3);
const adminHash = requireValue("ADMIN_PASSWORD_HASH", 50).replace(/^['"]|['"]$/g, "").replace(/\\\$/g, "$");
if (adminHash && !/^\$2[aby]\$\d{2}\$/.test(adminHash)) errors.push("ADMIN_PASSWORD_HASH must be a bcrypt hash");
requireValue("CRON_SECRET", 32);
requireValue("NEXT_PUBLIC_OPERATOR_OGRNIP", 13);
requireValue("NEXT_PUBLIC_OPERATOR_ADDRESS", 8);

try {
  const site = new URL(requireValue("NEXT_PUBLIC_SITE_URL", 12));
  if (site.protocol !== "https:") errors.push("NEXT_PUBLIC_SITE_URL must use HTTPS");
} catch {
  errors.push("NEXT_PUBLIC_SITE_URL must be a valid URL");
}

for (const [left, right] of [
  ["TINKOFF_TERMINAL_KEY", "TINKOFF_PASSWORD"],
  ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  ["NEXT_PUBLIC_UMAMI_ID", "NEXT_PUBLIC_UMAMI_SRC"],
]) {
  if (!!value(left) !== !!value(right)) errors.push(`${left} and ${right} must be configured together`);
}
if (value("EMAIL_API_KEY") && !value("EMAIL_FROM")) errors.push("EMAIL_FROM is required when EMAIL_API_KEY is configured");
const smtpFields = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"];
const smtpConfiguredFields = smtpFields.filter((name) => value(name));
if (smtpConfiguredFields.length && smtpConfiguredFields.length !== smtpFields.length) {
  errors.push("SMTP_HOST, SMTP_USER and SMTP_PASSWORD must be configured together");
}
if (smtpConfiguredFields.length && !value("EMAIL_FROM")) errors.push("EMAIL_FROM is required when SMTP is configured");
if (value("SMTP_PORT") && (!Number.isInteger(Number(value("SMTP_PORT"))) || Number(value("SMTP_PORT")) < 1 || Number(value("SMTP_PORT")) > 65535)) {
  errors.push("SMTP_PORT must be a valid TCP port");
}
if (!!value("SMSAERO_EMAIL") !== !!value("SMSAERO_API_KEY")) errors.push("SMSAERO_EMAIL and SMSAERO_API_KEY must be configured together");

for(const channel of ['EMAIL','MAX']){
  const flag=`NOTIFICATIONS_${channel}_V1_ENABLED`;
  if(value(flag)&&!['true','false'].includes(value(flag)))errors.push(`${flag} must be true or false`);
  if(value(flag)==='true'){
    const name=`NOTIFICATIONS_${channel}_V1_ACTIVE_SINCE`,timestamp=requireValue(name);
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(timestamp)||!Number.isFinite(Date.parse(timestamp))||Date.parse(timestamp)>Date.now()+60000)errors.push(`${name} must be a current UTC activation boundary`);
  }
}
if(value('NOTIFICATIONS_EMAIL_V1_ENABLED')==='true'){
  for(const name of ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'])requireValue(name);
  requireValue('NOTIFICATION_RESET_KEY',32);
  if((value('SMTP_PORT')||'587')!=='587'||(value('SMTP_SECURE')&&value('SMTP_SECURE')!=='false'))errors.push('Notification SMTP requires STARTTLS on port 587');
}
if(value('NOTIFICATIONS_MAX_V1_ENABLED')==='true'){
  requireValue('MAX_BOT_TOKEN');requireValue('MAX_WEBHOOK_SECRET',32);
  try{const bot=new URL(requireValue('MAX_BOT_URL'));if(bot.protocol!=='https:'||bot.hostname!=='max.ru'||bot.username||bot.password||bot.port||bot.search||bot.hash||!/^\/[A-Za-z0-9_-]+$/.test(bot.pathname))errors.push('MAX_BOT_URL must be an official HTTPS bot link');}
  catch{errors.push('MAX_BOT_URL must be an official HTTPS bot link');}
}

if (errors.length) {
  console.error("Production environment validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production environment is valid");
