// Load the synthetic environment without passing --env-file to Next workers.
const path = require('node:path');
process.loadEnvFile(path.resolve(__dirname, '../.env.journey-qa.example'));
for(const key of ['SMTP_HOST','SMTP_USER','SMTP_PASSWORD','EMAIL_API_KEY','SMSAERO_EMAIL','SMSAERO_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TINKOFF_TERMINAL_KEY','TINKOFF_PASSWORD','NEXT_PUBLIC_UMAMI_ID','NEXT_PUBLIC_UMAMI_SRC'])process.env[key]='';
process.env.ADMIN_PASSWORD_HASH = require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD, 10);
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '15432' || !/^\/audit_regression_\d+$/.test(url.pathname)) {
  throw new Error('Only the isolated local QA database is allowed');
}
require('next/dist/bin/next');
