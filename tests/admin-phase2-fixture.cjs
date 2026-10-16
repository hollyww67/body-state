const {Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL);
if(url.hostname!=='postgres'||url.pathname!=='/scheduling_v2_browser'||process.env.DESIGN_QA_SYNTHETIC!=='true')throw Error('Synthetic design QA only');
const pool=new Pool({connectionString:url.toString()});
(async()=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query("INSERT INTO products(name,slug,price,stock) VALUES('Синтетический товар QA','phase2-synthetic-product',1000,5) ON CONFLICT(slug) DO NOTHING");
  await client.query("INSERT INTO psychology_programs(title,slug,description,price,duration) VALUES('Синтетическая программа QA','phase2-synthetic-program','Только изолированный UI QA',1500,'90 минут') ON CONFLICT(slug) DO NOTHING");
  const exists=await client.query("SELECT id FROM orders WHERE client_name='Синтетический заказ QA'");
  if(!exists.rowCount)await client.query("INSERT INTO orders(client_name,client_phone,address,delivery,total,status,items) VALUES('Синтетический заказ QA','+70000000000','Тестовый адрес','pickup',1000,'pending',$1)",[JSON.stringify([{name:'Синтетический товар QA',quantity:1,price:1000}])]);
  const media=await client.query("SELECT id FROM media_gallery WHERE title='Синтетический материал QA'");
  if(!media.rowCount)await client.query("INSERT INTO media_gallery(title,description,media_type,is_published) VALUES('Синтетический материал QA','Тест редактора, не данные клиента','photo',false)");
  await client.query('COMMIT');
  const program=await client.query("SELECT id FROM psychology_programs WHERE slug='phase2-synthetic-program'");
  const gallery=await client.query("SELECT id FROM media_gallery WHERE title='Синтетический материал QA'");
  console.log(JSON.stringify({synthetic:true,program:program.rows[0].id,media:gallery.rows[0].id}));
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
