import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { calculatePromoDiscount, type PromoCodeRecord } from "@/lib/promo-codes";

export type OrderItem = {
  productId?: string;
  name?: string;
  price?: number;
  quantity?: number;
  bookingId?: string;
  bookingType?: string;
};

type LockedOrder = {
  id: string;
  status: string;
  items: OrderItem[];
  stock_released_at: string | null;
};

function inventoryItems(items: OrderItem[]) {
  const totals = new Map<string, number>();
  for (const item of items || []) {
    const quantity = Number(item.quantity);
    if (item.productId && Number.isInteger(quantity) && quantity > 0) totals.set(item.productId, (totals.get(item.productId) || 0) + quantity);
  }
  // Aggregate duplicate lines and lock products in stable order to avoid deadlocks.
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => ({ productId, quantity }));
}

async function releaseInventory(client: PoolClient, items: OrderItem[]) {
  for (const item of inventoryItems(items)) {
    await client.query(
      "UPDATE products SET stock = stock + $1, updated_at = now() WHERE id = $2",
      [item.quantity, item.productId],
    );
  }
}

async function tryReserveInventory(client: PoolClient, items: OrderItem[]) {
  const products = inventoryItems(items);
  for (const item of products) {
    const result = await client.query<{ stock: number }>(
      "SELECT stock FROM products WHERE id = $1 FOR UPDATE",
      [item.productId],
    );
    if (!result.rows[0] || Number(result.rows[0].stock) < item.quantity) return false;
  }
  for (const item of products) {
    await client.query(
      "UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2",
      [item.quantity, item.productId],
    );
  }
  return true;
}

export async function createPendingOrderWithReservation(
  order: Record<string, unknown>,
  items: OrderItem[],
) {
  // UUID identity must match PostgreSQL equality, including historical JSON casing.
  items = items.map((item) => {
    if (!item.bookingId) return item;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.bookingId)) throw new Error("BOOKING_UNAVAILABLE");
    return { ...item, bookingId: item.bookingId.toLowerCase() };
  });
  return db.transaction(async (client) => {
    const bookingItems = items.filter((item) => item.bookingId);
    if (bookingItems.length) {
      await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
      const seen = new Set<string>();
      for (const item of bookingItems) {
        if (!["bfm", "brt", "psychology"].includes(String(item.bookingType))) throw new Error("BOOKING_UNAVAILABLE");
        const key = `${item.bookingType}:${item.bookingId}`;
        if (seen.has(key)) throw new Error("BOOKING_ALREADY_PAYABLE");
        seen.add(key);
        const booking = await client.query(`SELECT status,hold_expires_at FROM ${item.bookingType}_bookings WHERE id=$1 FOR UPDATE`, [item.bookingId]);
        if (booking.rows[0]?.status !== "pending") throw new Error("BOOKING_UNAVAILABLE");
        if(booking.rows[0].hold_expires_at && new Date(booking.rows[0].hold_expires_at)<=new Date())throw new Error('BOOKING_UNAVAILABLE');
        const existing = await client.query(`SELECT 1 FROM orders o, jsonb_array_elements(o.items) item
          WHERE lower(item->>'bookingId')=$1 AND item->>'bookingType'=$2
            AND o.status IN ('pending','paid','shipped','delivered') LIMIT 1`, [item.bookingId, item.bookingType]);
        if (existing.rowCount) throw new Error("BOOKING_ALREADY_PAYABLE");
      }
    }
    for (const item of inventoryItems(items)) {
      const result = await client.query(
        "UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2 AND stock >= $1 RETURNING id",
        [item.quantity, item.productId],
      );
      if (result.rowCount !== 1) throw new Error("OUT_OF_STOCK");
    }

    let reservedPromo: PromoCodeRecord | null = null;
    if (order.promo_code_id) {
      const promoResult = await client.query<PromoCodeRecord>(
        `SELECT id, code, discount_type, discount_value, service_codes, max_redemptions,
                redeemed_count, reserved_count, expires_at, is_active, assigned_account_user_id
           FROM promo_codes WHERE id=$1 FOR UPDATE`,
        [order.promo_code_id],
      );
      reservedPromo = promoResult.rows[0] || null;
      const serviceCode = String(order.promo_service_code || "");
      const subtotal = Number(order.subtotal);
      const expectedDiscount = Number(order.discount_amount);
      if (!reservedPromo || !reservedPromo.is_active) throw new Error("PROMO_UNAVAILABLE");
      if (reservedPromo.assigned_account_user_id && reservedPromo.assigned_account_user_id !== order.account_user_id) throw new Error("PROMO_UNAVAILABLE");
      if (reservedPromo.expires_at && new Date(reservedPromo.expires_at).getTime() <= Date.now()) throw new Error("PROMO_UNAVAILABLE");
      if (!reservedPromo.service_codes.includes(serviceCode)) throw new Error("PROMO_UNAVAILABLE");
      if (reservedPromo.max_redemptions !== null && reservedPromo.redeemed_count + reservedPromo.reserved_count >= reservedPromo.max_redemptions) throw new Error("PROMO_EXHAUSTED");
      const currentDiscount = calculatePromoDiscount(subtotal, reservedPromo.discount_type, Number(reservedPromo.discount_value));
      if (currentDiscount <= 0 || currentDiscount >= subtotal || Math.round(currentDiscount * 100) !== Math.round(expectedDiscount * 100)) throw new Error("PROMO_CHANGED");
      await client.query("UPDATE promo_codes SET reserved_count=reserved_count+1, updated_at=now() WHERE id=$1", [reservedPromo.id]);
    }

    const result = await client.query(
      `INSERT INTO orders (
        external_order_id, client_name, client_phone, address, items, total, status,
        receipt_email, receipt_phone, payment_method, payment_link_expires_at,
        consent_version, consent_at, account_user_id, subtotal, discount_amount,
        promo_code_id, promo_code, loyalty_client_phone, loyalty_service_code,
        counts_as_visit
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,'pending',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        order.external_order_id,
        order.client_name,
        order.client_phone,
        order.address,
        JSON.stringify(items),
        order.total,
        order.receipt_email || null,
        order.receipt_phone || null,
        order.payment_method || "tinkoff",
        order.payment_link_expires_at || null,
        order.consent_version,
        order.consent_at,
        order.account_user_id || null,
        order.subtotal ?? order.total,
        order.discount_amount || 0,
        reservedPromo?.id || null,
        reservedPromo?.code || null,
        order.loyalty_client_phone || null,
        order.loyalty_service_code || null,
        order.counts_as_visit === true,
      ],
    );
    if (reservedPromo) {
      await client.query(
        "INSERT INTO promo_redemptions (promo_code_id, order_id, status) VALUES ($1,$2,'pending')",
        [reservedPromo.id, result.rows[0].id],
      );
    }
    return result.rows[0];
  });
}

type TransitionOptions = {
  allowedFrom?: string[];
  releaseStock?: boolean;
  paidAt?: string;
  amountPaid?: number;
  paymentData?: unknown;
};

export async function transitionOrderState(orderId: string, nextStatus: string, options: TransitionOptions = {}, transactionClient?: PoolClient) {
  const transition = async (client: PoolClient) => {
    const found = await client.query<LockedOrder>(
      "SELECT id, status, items, stock_released_at FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    const order = found.rows[0];
    if (!order) return { changed: false, reason: "not_found" as const, order: null };
    if (order.status === nextStatus) return { changed: false, reason: "unchanged" as const, order };
    if (options.allowedFrom && !options.allowedFrom.includes(order.status)) {
      return { changed: false, reason: "status_conflict" as const, order };
    }

    let stockReleasedAt = order.stock_released_at;
    let inventoryIssue = false;

    if (options.releaseStock && !stockReleasedAt) {
      await releaseInventory(client, order.items || []);
      stockReleasedAt = new Date().toISOString();
    } else if (nextStatus === "paid" && stockReleasedAt) {
      const reserved = await tryReserveInventory(client, order.items || []);
      inventoryIssue = !reserved;
      if (reserved) stockReleasedAt = null;
    }

    await client.query(
      `UPDATE orders SET status=$2, stock_released_at=$3, inventory_issue=$4,
       paid_at=COALESCE($5, paid_at), amount_paid=COALESCE($6, amount_paid),
       payment_data=COALESCE($7::jsonb, payment_data), updated_at=now()
       WHERE id=$1`,
      [
        orderId,
        nextStatus,
        stockReleasedAt,
        inventoryIssue,
        options.paidAt || null,
        options.amountPaid ?? null,
        options.paymentData === undefined ? null : JSON.stringify(options.paymentData),
      ],
    );

    const redemptionResult = await client.query<{ promo_code_id: string; status: string }>(
      "SELECT promo_code_id, status FROM promo_redemptions WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    const redemption = redemptionResult.rows[0];
    if (redemption && nextStatus === "paid" && redemption.status !== "redeemed") {
      await client.query("UPDATE promo_redemptions SET status='redeemed', redeemed_at=now(), updated_at=now() WHERE order_id=$1", [orderId]);
      await client.query(
        `UPDATE promo_codes SET redeemed_count=redeemed_count+1,
         reserved_count=GREATEST(0, reserved_count-$2), updated_at=now() WHERE id=$1`,
        [redemption.promo_code_id, redemption.status === "pending" ? 1 : 0],
      );
    } else if (redemption && ["failed", "cancelled"].includes(nextStatus) && redemption.status === "pending") {
      await client.query("UPDATE promo_redemptions SET status='cancelled', updated_at=now() WHERE order_id=$1", [orderId]);
      await client.query("UPDATE promo_codes SET reserved_count=GREATEST(0, reserved_count-1), updated_at=now() WHERE id=$1", [redemption.promo_code_id]);
    }

    return { changed: true, reason: "updated" as const, order, inventoryIssue };
  };
  return transactionClient ? transition(transactionClient) : db.transaction(transition);
}
