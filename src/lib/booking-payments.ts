import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { refreshSlotOccupancy, type ServiceType } from "@/lib/slots";
import type { OrderItem } from "@/lib/order-stock";
import { enqueueAppointment, invalidateAppointmentNotifications, scheduleReminder } from '@/lib/appointment-notifications';
import { findBookingPaymentCases } from '@/lib/payment-cases';

const BOOKING_TABLES: Record<ServiceType, string> = {
  bfm: "bfm_bookings",
  brt: "brt_bookings",
  psychology: "psychology_bookings",
};

export function isPayableBookingType(value: unknown): value is ServiceType {
  return value === "bfm" || value === "brt" || value === "psychology";
}

/** Applies a payment outcome to appointment bookings without manual approval. */
export async function settleBookingPayments(items: OrderItem[], outcome: "paid" | "cancelled", orderId?: string) {
  for (const item of items || []) {
    if (!item.bookingId || !isPayableBookingType(item.bookingType)) continue;
    const service = item.bookingType;
    const table = BOOKING_TABLES[service];

    if (outcome === "cancelled") {
      await db.transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
        // Replay repairs an interrupted terminal callback, but must not cancel a
        // booking if a concurrent CONFIRMED has already committed its paid fact.
        // The order row remains locked through the cancellation and occupancy update.
        if (orderId) {
          const order = await client.query<{status:string}>('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
          if (!order.rows[0] || !['failed','cancelled'].includes(order.rows[0].status)) return;
          const replacement = await client.query(`SELECT 1 FROM orders o, jsonb_array_elements(o.items) item
            WHERE o.id<>$1 AND lower(item->>'bookingId')=lower($2)
              AND item->>'bookingType'=$3 AND o.status IN ('pending','paid','shipped','delivered')
            LIMIT 1`, [orderId,item.bookingId,service]);
          if (replacement.rowCount) return;
        }
        const r=await client.query(`UPDATE ${table} SET status='cancelled',updated_at=now() WHERE id=$1 AND status='pending' RETURNING slot_id`,[item.bookingId]);
        if(r.rows[0]){await invalidateAppointmentNotifications(client,service,item.bookingId!);await enqueueAppointment(client,service,item.bookingId!,'cancelled');}
        if(r.rows[0]) await refreshSlotOccupancy(client);
      });
      continue;
    }

    await db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const found = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [item.bookingId]);
      const current = found.rows[0];
      if (!current) throw new Error("BOOKING_SETTLEMENT_NOT_FOUND");
      // A late bank callback must record the money even after manual confirmation
      // or cancellation, without resurrecting a cancelled appointment.
      const nextStatus = current.status === "pending" ? "confirmed" : current.status;
      const room = service === "psychology" && current.booking_type === "online" && nextStatus === "confirmed"
        ? current.room_id || randomUUID() : current.room_id;
      await client.query(
        `UPDATE ${table} SET status=$2, payment_status='paid', updated_at=now()${service === "psychology" ? ", room_id=$3" : ""} WHERE id=$1`,
        service === "psychology" ? [item.bookingId, nextStatus, room] : [item.bookingId, nextStatus],
      );
      if(current.status==='cancelled')await findBookingPaymentCases(item.bookingId!,service,client);
      if(current.status==='pending'){
        await invalidateAppointmentNotifications(client,service,item.bookingId!);
        await enqueueAppointment(client,service,item.bookingId!,'confirmed');
        await scheduleReminder(client,service,item.bookingId!);
      }
      return current.status === "pending" ? current : null;
    });
  }
}
