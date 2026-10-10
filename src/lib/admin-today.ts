import {pool} from '@/lib/db';
export const moscowDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
export async function readAdminToday(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(new Date(day+'T00:00:00Z').getTime())||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw new Error('INVALID_DAY');
 const start=day+'T00:00:00+03:00',end=new Date(new Date(start).getTime()+86400000).toISOString();
 const union=['bfm','brt','psychology'].map(s=>`SELECT b.id::text,'${s}' AS service,b.client_name,b.status,b.payment_option,b.payment_status,b.attendance,s.slot_time,b.created_at FROM ${s}_bookings b JOIN slots s ON s.id=b.slot_id`).join(' UNION ALL ');
 const [appointments,actions,failures,cases,funnel]=await Promise.all([
 pool.query(`SELECT * FROM (${union}) b WHERE slot_time>=$1 AND slot_time<$2 ORDER BY slot_time`,[start,end]),
 pool.query(`SELECT id::text,name AS client_name,'consultation' AS service,status,created_at,NULL::timestamptz AS slot_time FROM consultation_enrollments WHERE status='new' UNION ALL SELECT id::text,client_name,'program',status,created_at,NULL::timestamptz FROM program_enrollments WHERE status IN ('new','pending') UNION ALL SELECT id,client_name,service,status,created_at,slot_time FROM (${union}) b WHERE status='pending' AND slot_time>=$1 AND slot_time<$2 ORDER BY created_at LIMIT 100`,[start,end]),
 pool.query(`SELECT id,booking_id,service_type,event_type,channel,status,last_error FROM appointment_notifications WHERE status IN ('failed','not_configured','uncertain') ORDER BY updated_at DESC LIMIT 100`),
 pool.query(`SELECT c.id,c.order_id,c.booking_id,c.service_type,c.reason,c.status,o.total,o.status AS payment_status FROM payment_cases c JOIN orders o ON o.id=c.order_id WHERE c.status='open' ORDER BY c.created_at LIMIT 100`),
 pool.query(`SELECT
 (SELECT count(*) FROM (${union}) b WHERE created_at>=$1 AND created_at<$2) AS booking_created,
 (SELECT count(*) FROM orders WHERE created_at>=$1 AND created_at<$2 AND EXISTS(SELECT 1 FROM jsonb_array_elements(items) i WHERE i->>'bookingId' IS NOT NULL)) AS online_payment_started,
 (SELECT count(*) FROM orders WHERE paid_at>=$1 AND paid_at<$2 AND EXISTS(SELECT 1 FROM jsonb_array_elements(items) i WHERE i->>'bookingId' IS NOT NULL)) AS payment_confirmed,
 (SELECT count(DISTINCT v.booking_id) FROM client_visits v JOIN (${union}) b ON b.id=v.booking_id::text WHERE v.source_type='booking' AND b.attendance='present' AND v.completed_at>=$1 AND v.completed_at<$2) AS appointment_attended`,[start,end])
 ]);
 return {day,appointments:appointments.rows,actions:actions.rows,atAppointment:appointments.rows.filter(b=>b.payment_option==='at_appointment'&&b.payment_status==='due'&&b.status!=='cancelled'),notifications:failures.rows,paymentCases:cases.rows,funnel:funnel.rows[0]};
}
