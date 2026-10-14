// Injected only into the isolated regression harness; no production code.
module.exports = async ({assert,pool,test,claimSlot,slot,fields,baseOrder,createPendingOrderWithReservation,signedCallback,settlement}) => {
 for (const [i,Status] of ['REJECTED','CANCELED'].entries()) await test('Delivery interrupted '+Status+' replay repairs once and stale failure preserves paid',async()=>{
  const booking=await claimSlot(await slot(`2140-01-${String(i+2).padStart(2,'0')}T09:30:00+03:00`),'bfm',fields());
  const order=await createPendingOrderWithReservation(baseOrder(),[{bookingId:booking.booking.id,bookingType:'bfm'}]);
  const PaymentId='delivery-replay-'+i;await pool.query('UPDATE orders SET payment_id=$2 WHERE id=$1',[order.id,PaymentId]);
  const body={TerminalKey:'audit-terminal',PaymentId,OrderId:order.id,Status,Success:true,Amount:100000};
  const saved=settlement.settleBookingPayments;settlement.settleBookingPayments=async()=>{throw Error('Synthetic interrupted terminal settlement');};
  try{assert.equal((await signedCallback(body)).status,500);}finally{settlement.settleBookingPayments=saved;}
  assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].status,'pending');
  assert.equal((await signedCallback(body)).status,200);assert.equal((await signedCallback(body)).status,200);
  assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].status,'cancelled');
  assert.equal((await pool.query("SELECT count(*)::int n FROM booking_events WHERE booking_id=$1 AND new_status='cancelled'",[booking.booking.id])).rows[0].n,1);
  assert.equal((await signedCallback({...body,Status:'CONFIRMED'})).status,200);
  assert.equal((await signedCallback(body)).status,200);
  assert.equal((await pool.query('SELECT payment_status FROM bfm_bookings WHERE id=$1',[booking.booking.id])).rows[0].payment_status,'paid');
 });
 await test('Delivery stale failed callback cannot cancel a replacement pending payment',async()=>{
  const visit=await claimSlot(await slot('2140-02-03T09:30:00+03:00'),'bfm',fields());
  const items=[{bookingId:visit.booking.id,bookingType:'bfm'}];
  const old=await createPendingOrderWithReservation(baseOrder(),items);
  await pool.query("UPDATE orders SET status='failed',payment_id='delivery-old-failed' WHERE id=$1",[old.id]);
  const next=await createPendingOrderWithReservation(baseOrder(),items);
  assert.equal((await signedCallback({TerminalKey:'audit-terminal',PaymentId:'delivery-old-failed',OrderId:old.id,Status:'REJECTED',Success:true,Amount:100000})).status,200);
  assert.equal((await pool.query('SELECT status FROM bfm_bookings WHERE id=$1',[visit.booking.id])).rows[0].status,'pending');
  assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[next.id])).rows[0].status,'pending');
  assert.equal((await pool.query("SELECT count(*)::int n FROM booking_events WHERE booking_id=$1 AND new_status='cancelled'",[visit.booking.id])).rows[0].n,0);
 });
};
