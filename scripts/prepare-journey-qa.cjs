// Disposable, synthetic local data only; never prepares a production database.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
process.loadEnvFile(path.resolve(__dirname, '../.env.journey-qa.example'));
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '15432' || !/^\/audit_regression_\d+$/.test(url.pathname)) throw new Error('Not an isolated QA database');
const result=spawnSync(process.execPath,[path.resolve(__dirname,'migrate.mjs')],{env:process.env,stdio:'inherit'});
if(result.status!==0)throw new Error('Migration failed');
const pool=new (require('pg').Pool)({connectionString:url.toString()});
(async()=>{
  const hash=require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD,10);
  await pool.query("INSERT INTO settings(key,value) VALUES('admin_password_hash',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[hash]);
  for(const service of ['bfm','brt','psychology'])for(let day=1;day<=3;day++){
    const date=new Date(Date.now()+day*86400000).toISOString().slice(0,10)+'T12:00:00+03:00';
    await pool.query('INSERT INTO slots(service_type,slot_time,duration_minutes) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM slots WHERE service_type=$1 AND slot_time=$2)',[service,date,service==='brt'?60:90]);
  }
  console.log('Local QA prepared. Login: qa-admin. Password is in .env.journey-qa.example.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>pool.end());
