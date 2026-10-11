const fs = require('node:fs');
const path = require('node:path');
module.exports = function isolatedEnvironment() {
  const root = path.resolve(__dirname, '..');
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
    if (fs.existsSync(path.join(root, file))) throw new Error(`Private environment file forbidden in QA workspace: ${file}`);
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key)));
  Object.assign(env, require('node:util').parseEnv(fs.readFileSync(path.join(root, '.env.journey-qa.example'), 'utf8')));
  const db = new URL(env.DATABASE_URL);
  if (db.hostname !== '127.0.0.1' || db.port !== '15432' || !/^\/audit_regression_\d+$/.test(db.pathname) || env.REDIS_URL !== 'redis://127.0.0.1:16379') throw new Error('Only isolated local DB/Redis are permitted');
  return env;
};
