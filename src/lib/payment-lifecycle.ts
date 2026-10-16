import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { transitionOrderState, type OrderItem } from "@/lib/order-stock";
import { settleBookingPayments, isPayableBookingType } from "@/lib/booking-payments";
import { openPaymentCase } from "@/lib/payment-cases";
import { recordSuccessfulVisit } from "@/lib/loyalty";
import { enqueueOrderNotification } from '@/lib/notification-core';

const PAID = new Set(["paid", "shipped", "delivered"]);
type Order = {
  id: string; status: string; items: OrderItem[]; total: number; payment_id: string | null;
  counts_as_visit: boolean; loyalty_client_phone: string | null; receipt_email: string | null;
  loyalty_service_code: "bfm" | "brt" | "psychology" | "psychology_program" | null;
  account_user_id: string | null;
};
type Outcome = { status: number; notify?: { id: string; total: number } };
export function isMonetaryNotification(status: string) {
  return ["CONFIRMED", "PARTIAL_REFUNDED", "REFUNDED"].includes(status);
}

/** Order lock serializes history dedup; no migration or external I/O is required. */
async function exception(client: PoolClient, order: Order, reason: string, data: Record<string, unknown>) {
  const item = order.items.find(i => i.bookingId && isPayableBookingType(i.bookingType));
  await openPaymentCase(client, order.id, reason, item?.bookingId, item?.bookingType);
  const found = await client.query<{id:string;status:string}>("SELECT id,status FROM payment_cases WHERE order_id=$1 AND reason=$2 FOR UPDATE", [order.id, reason]);
  const current = found.rows[0];
  if (!current) throw new Error("PAYMENT_EXCEPTION_NOT_DURABLE");
  // Keep normalized bank evidence, not PAN/contact/Token/Password. Distinct
  // signed payloads have distinct fingerprints; identical retries add no rows.
  const canonical = Object.fromEntries(Object.entries(data)
    .filter(([k,v]) => !["Token","Password","__proto__"].includes(k) && v != null && typeof v !== "object")
    .sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,String(v)]));
  const eventHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const evidence = Object.fromEntries(["Status","PaymentId","OrderId","Amount","Success","ErrorCode","TerminalKey"].filter(k => canonical[k] !== undefined).map(k => [k,canonical[k]]));
  const actor = "payment_callback:" + eventHash;
  const recorded = await client.query("SELECT 1 FROM payment_case_history WHERE case_id=$1 AND actor=$2", [current.id,actor]);
  if (recorded.rowCount) return false;
  if (current.status === "resolved") {
    // A new event requires a fresh review; an identical bank retry must not
    // reopen a case already resolved by the administrator.
    await client.query("UPDATE payment_cases SET status='open',result=NULL,resolved_at=NULL,updated_by='payment_callback',updated_at=now() WHERE id=$1", [current.id]);
    current.status = "open";
  }
  await client.query(`INSERT INTO payment_case_history(case_id,actor,status,comment)
    SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM payment_case_history WHERE case_id=$1 AND actor=$2)`,
    [current.id, actor, current.status, JSON.stringify({eventHash, event:evidence, policy:"service_preserved_pending_manual_review"})]);
  return true;
}

/** One PoolClient, one commit: scheduling lock -> current order -> bookings. */
export async function processMonetaryNotification(data: Record<string, unknown>): Promise<Outcome> {
  const status = String(data.Status || "").toUpperCase();
  if (!isMonetaryNotification(status) || !data.PaymentId) return {status:503};
  const paymentId = String(data.PaymentId);
  const externalOrder = typeof data.OrderId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.OrderId) ? data.OrderId : null;
  return db.transaction(async client => {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
    const found = await client.query<Order>(`SELECT * FROM orders WHERE payment_id=$1 OR id=$2::uuid
      ORDER BY (payment_id=$1) DESC NULLS LAST LIMIT 1 FOR UPDATE`, [paymentId, externalOrder]);
    const order = found.rows[0];
    if (!order) return {status:503};
    if (order.payment_id && String(order.payment_id) !== paymentId) return {status:409};
    if (status === "CONFIRMED" && order.status !== "refunded" &&
        (!Number.isFinite(Number(data.Amount)) || Number(data.Amount) !== Math.round(Number(order.total)*100))) return {status:400};
    if (!order.payment_id) {
      await client.query("UPDATE orders SET payment_id=$2 WHERE id=$1", [order.id,paymentId]);
      order.payment_id = paymentId;
    }

    if (status === "REFUNDED") {
      const transition = await transitionOrderState(order.id, "refunded", {
        allowedFrom:["pending","paid","shipped","delivered","failed","cancelled"],
        releaseStock: !["shipped","delivered"].includes(order.status), paymentData:data,
      }, client);
      if (!transition.changed && transition.order?.status !== "refunded") return {status:503};
      // Owner-approved policy: preserve the service/history/previous access,
      // never invent debt or cancel an appointment on a bank refund.
      await exception(client, order, "full_refund_service_review", data);
      return {status:200};
    }
    if (order.status === "refunded") {
      // A superseded CONFIRMED cannot create a room, confirmation or reward.
      await exception(client, order, "full_refund_service_review", data);
      return {status:200};
    }

    let newlyPaid = false;
    if (status === "PARTIAL_REFUNDED") {
      const newEvent = await exception(client, order, "partial_refund_service_review", data);
      if (newEvent) await client.query("UPDATE orders SET payment_data=$2::jsonb WHERE id=$1", [order.id,JSON.stringify(data)]);
      // A partial callback alone does not prove the original paid amount.
      // Preserve the evidence for review; do not infer pricing/debt.
      if (!PAID.has(order.status)) return {status:200};
    } else {
      const transition = await transitionOrderState(order.id, "paid", {
        allowedFrom:["pending","failed","cancelled"], paidAt:new Date().toISOString(),
        amountPaid:Number(order.total), paymentData:data,
      }, client);
      if (!transition.changed && !PAID.has(transition.order?.status || "")) return {status:503};
      newlyPaid = transition.changed;
    }

    // Detect a lost link before the helper: money + explicit exception remain
    // durable, but no ACK falsely claims that the missing booking is settled.
    let missing = false;
    const linked = order.items.filter(i => i.bookingId && isPayableBookingType(i.bookingType))
      .sort((a,b) => (String(a.bookingType)+a.bookingId).localeCompare(String(b.bookingType)+b.bookingId));
    for (const item of linked) {
      const current = await client.query(`SELECT id FROM ${item.bookingType}_bookings WHERE id=$1 FOR UPDATE`, [item.bookingId]);
      if (!current.rowCount) missing = true;
    }
    if (missing) {
      await exception(client, order, "payment_booking_missing", data);
      return {status:500};
    }
    await settleBookingPayments(order.items || [], "paid", order.id, client);
    if (order.counts_as_visit && order.loyalty_client_phone && order.loyalty_service_code) {
      await recordSuccessfulVisit({accountUserId:order.account_user_id,phone:order.loyalty_client_phone,
        email:order.receipt_email,serviceCode:order.loyalty_service_code,orderId:order.id}, client);
    }
    if(status==='CONFIRMED'&&!linked.length)await enqueueOrderNotification(client,order.id);
    return {status:200, ...(newlyPaid ? {notify:{id:order.id,total:Number(order.total)}} : {})};
  });
}

