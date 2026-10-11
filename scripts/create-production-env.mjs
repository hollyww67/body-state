import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const input = process.argv[2]?.trim();
if (!input) {
  console.error("Usage: node scripts/create-production-env.mjs example.ru");
  process.exit(1);
}

const domain = input.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
  console.error("Provide a valid public domain, for example: example.ru");
  process.exit(1);
}

try {
  await access(".env.production", constants.F_OK);
  console.error(".env.production already exists; refusing to overwrite it");
  process.exit(1);
} catch {
  // The target is intentionally created only when it does not exist.
}

const postgresPassword = randomBytes(24).toString("hex");
const redisPassword = randomBytes(24).toString("hex");
const cronSecret = randomBytes(32).toString("hex");
const accountAuthSecret = randomBytes(32).toString("hex");
const adminPassword = randomBytes(18).toString("base64url");
const adminHash = bcrypt.hashSync(adminPassword, 12);

const content = `DOMAIN=${domain}
NEXT_PUBLIC_SITE_URL=https://${domain}
APP_PORT=3000
UPLOADS_DIR=/var/www/doctor-site-uploads

NEXT_PUBLIC_OPERATOR_OGRNIP=
NEXT_PUBLIC_OPERATOR_ADDRESS=

POSTGRES_PASSWORD=${postgresPassword}
REDIS_PASSWORD=${redisPassword}
POSTGRES_POOL_SIZE=10

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='${adminHash}'
CRON_SECRET=${cronSecret}
ACCOUNT_AUTH_SECRET=${accountAuthSecret}

NEXT_PUBLIC_TELEGRAM_URL=
NEXT_PUBLIC_VK_URL=
NEXT_PUBLIC_UMAMI_ID=
NEXT_PUBLIC_UMAMI_SRC=
NEXT_PUBLIC_TINKOFF_TERMINAL_KEY=
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
NEXT_PUBLIC_TURN_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SMSAERO_EMAIL=
SMSAERO_API_KEY=
EMAIL_API_KEY=
EMAIL_FROM=noreply@${domain}
EMAIL_FROM_NAME=Пространство
EMAIL_REPLY_TO=admin@${domain}
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=

TINKOFF_TERMINAL_KEY=
TINKOFF_PASSWORD=
TINKOFF_TAXATION=usn_income
JITSI_HOST=
`;

await writeFile(".env.production", content, { encoding: "utf8", mode: 0o600, flag: "wx" });

console.log("Created .env.production with generated secrets.");
console.log("Save these credentials now; the password is not stored in plain text:");
console.log("Admin username: admin");
console.log(`Admin password: ${adminPassword}`);
