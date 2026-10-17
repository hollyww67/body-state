// Add synthetic UI appointments only to the named isolated QA database.
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== 'postgres' || url.pathname !== '/scheduling_v2_browser' || process.env.DESIGN_QA_SYNTHETIC !== 'true') throw Error('Synthetic design QA only');
const pool = new Pool({ connectionString: url.toString() });
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
    for (const [index, time] of ['09:00', '11:00', '13:00', '15:00', '17:00'].entries()) {
      const service = ['bfm', 'psychology', 'brt', 'bfm', 'psychology'][index];
      const name = `QA Stage3 клиент ${index + 1}`;
      const existing = await client.query(`SELECT id FROM ${service}_bookings WHERE client_name=$1`, [name]);
      if (existing.rowCount) continue;
      const slot = await client.query('INSERT INTO slots(slot_time,service_type,is_booked,duration_minutes) VALUES($1,$2,true,90) RETURNING id', [`${day}T${time}:00+03:00`, service]);
      await client.query(`INSERT INTO ${service}_bookings(slot_id,client_name,client_phone,client_email,status,payment_status) VALUES($1,$2,$3,$4,'confirmed','due')`, [slot.rows[0].id, name, '+70000000000', `stage3-${index}@example.invalid`]);
    }
    await client.query('COMMIT');
    console.log('Stage3 synthetic appointments ready; no notifications/providers invoked.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
