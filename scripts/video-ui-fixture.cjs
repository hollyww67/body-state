const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../.env.journey-qa.example'));
if(!process.env.DATABASE_URL.includes('127.0.0.1:15432/audit_regression_'))throw new Error('QA only');
const pool=new(require('pg').Pool)({connectionString:process.env.DATABASE_URL});
(async()=>{
 const email='video-ui@example.test';
 if(process.argv.includes('--cleanup')){
   await pool.query('DELETE FROM psychology_rooms WHERE account_user_id IN (SELECT id FROM account_users WHERE email=$1)',[email]);
   await pool.query('DELETE FROM account_users WHERE email=$1',[email]);return;
 }
 const hash=require('bcryptjs').hashSync('Video-QA-only-2026',10);
 await pool.query("INSERT INTO account_users(username,email,display_name,password_hash,consent_version,consent_at,verified_at) VALUES($1,$1,'Тест видеоконсультации',$2,'qa',now(),now()) ON CONFLICT(email) DO NOTHING",[email,hash]);
 console.log('Synthetic UI client ready: '+email);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
