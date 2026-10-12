const {Pool}=require('pg');
const bcrypt=require('bcryptjs');
const url=new URL(process.env.DATABASE_URL);
if(url.hostname!=='postgres'||url.pathname!=='/scheduling_v2_browser')throw Error('Synthetic browser QA DB only');
const pool=new Pool({connectionString:url.toString()});
(async()=>{
  await pool.query("INSERT INTO settings(key,value) VALUES('admin_password_hash',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[await bcrypt.hash('V2-QA-password-only',10)]);
  console.log('Synthetic QA login prepared; no production accounts used.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
