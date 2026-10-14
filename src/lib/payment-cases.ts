import type { PoolClient } from 'pg';
import { db, pool } from '@/lib/db';
export async function openPaymentCase(client:Pick<PoolClient,'query'>,orderId:string,reason:string,bookingId?:string,service?:string) {
  await client.query(`INSERT INTO payment_cases(order_id,reason,booking_id,service_type) VALUES($1,$2,$3,$4) ON CONFLICT(order_id,reason) DO NOTHING`,[orderId,reason,bookingId||null,service||null]);
}
export async function reviewPaymentCase(id:string,status:string,result:string,comment:string) {
  if(!['open','resolved'].includes(status)||comment.trim().length<5||comment.length>1000||status==='resolved'&&!['contacted_client','refund_handled_externally','new_booking_agreed','no_action_required'].includes(result))throw new Error('INVALID_REVIEW');
  // This project has one shared administrator, not a directory of staff identities.
  const actor='shared_admin';
  return db.transaction(async client=>{
    const r=await client.query(`SELECT id FROM payment_cases WHERE id=$1 FOR UPDATE`,[id]);if(!r.rows[0])return false;
    await client.query(`UPDATE payment_cases SET status=$2,result=$3,comment=$4,updated_by=$5,updated_at=now(),resolved_at=CASE WHEN $2='resolved' THEN now() ELSE NULL END WHERE id=$1`,[id,status,status==='resolved'?result:null,comment.trim(),actor]);
    await client.query(`INSERT INTO payment_case_history(case_id,actor,status,result,comment) VALUES($1,$2,$3,$4,$5)`,[id,actor,status,status==='resolved'?result:null,comment.trim()]);return true;
  });
}
export async function findBookingPaymentCases(bookingId:string,service:string,client:Pick<PoolClient,'query'>=pool) {
  const r=await client.query(`SELECT o.id FROM orders o,jsonb_array_elements(o.items) item WHERE lower(item->>'bookingId')=lower($1) AND item->>'bookingType'=$2 AND o.status IN ('paid','shipped','delivered')`,[bookingId,service]);
  for(const order of r.rows)await openPaymentCase(client,order.id,'paid_cancelled_booking',bookingId,service);
}
