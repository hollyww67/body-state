// Only fresh, isolated design QA. Never run against a customer/restore database.
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== 'postgres' || url.pathname !== '/scheduling_v2_browser' || process.env.DESIGN_QA_SYNTHETIC !== 'true') throw Error('Synthetic design QA DB only');
const pool = new Pool({connectionString: url.toString()});
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT count(*)::int AS n FROM bfm_bookings');
    if (existing.rows[0].n) throw Error('Fixture requires fresh empty bookings');
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow'}).format(new Date());
    for (const [i, time] of ['09:00','11:00','13:00','15:00','17:00'].entries()) {
      const service = ['bfm','psychology','brt','bfm','psychology'][i];
      const slot = await client.query('INSERT INTO slots(slot_time,service_type,is_booked,duration_minutes) VALUES($1,$2,true,90) RETURNING id', [`${day}T${time}:00+03:00`,service]);
      // service is a fixed fixture constant, never user input.
      await client.query(`INSERT INTO ${service}_bookings(slot_id,client_name,client_phone,client_email,status,payment_status) VALUES($1,$2,$3,$4,'confirmed','due')`, [slot.rows[0].id,`Тестовый клиент ${i+1}`, '+70000000000', `client${i+1}@example.invalid`]);
    }
    await client.query('COMMIT');
    console.log('Five synthetic appointments created; no provider requests.');
  } catch (e) {await client.query('ROLLBACK'); throw e;} finally {client.release();}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
