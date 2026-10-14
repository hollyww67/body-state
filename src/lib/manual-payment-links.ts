import { createHash } from "node:crypto";
import { pool } from "@/lib/db";
import { createPendingOrderWithReservation, type OrderItem } from "@/lib/order-stock";

export type ManualPaymentLinkRow = {
  id: string;
  items: Array<OrderItem & { manualPaymentRequestFingerprint?: string }>;
  total: number;
  status: string;
  receipt_email: string | null;
  loyalty_client_phone: string | null;
  loyalty_service_code: string | null;
  counts_as_visit: boolean;
  payment_id: string | null;
  payment_url: string | null;
  payment_link_expires_at: string | null;
  created_at: string;
};

export function manualPaymentRequestKey(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function manualPaymentFingerprint(payload: {
  name: string; kopecks: number; email: string; phone: string; serviceCode: string; lifetimeDays: number;
}) {
  return createHash("sha256").update(JSON.stringify([
    1, payload.name, payload.kopecks, payload.email, payload.phone, payload.serviceCode, payload.lifetimeDays,
  ])).digest("hex");
}

export class ManualPaymentConflict extends Error {
  constructor(public readonly code: "MANUAL_PAYLOAD_CONFLICT" | "MANUAL_INIT_UNRESOLVED") {
    super(code === "MANUAL_PAYLOAD_CONFLICT"
      ? "Эта операция уже отправлена с другими данными. Начните новый платёж."
      : "Операция уже отправлена. Проверьте историю или обратитесь к администратору; повторная инициализация отключена.");
  }
}

function replay(order: ManualPaymentLinkRow, fingerprint: string) {
  // Item metadata survives callbacks that replace payment_data.
  if (order.items?.[0]?.manualPaymentRequestFingerprint !== fingerprint) {
    throw new ManualPaymentConflict("MANUAL_PAYLOAD_CONFLICT");
  }
  if (!order.payment_url) throw new ManualPaymentConflict("MANUAL_INIT_UNRESOLVED");
  return { order, created: false };
}

export async function claimManualPaymentLink(
  requestKey: string,
  fingerprint: string,
  order: Record<string, unknown>,
  item: OrderItem,
) {
  // Fail closed for legacy callers too; never mint a server-side fallback key.
  const key = manualPaymentRequestKey(requestKey);
  if (!key) throw new Error("MANUAL_REQUEST_KEY_REQUIRED");
  const externalId = `manual-${key}`;
  const lookup = async () => (await pool.query<ManualPaymentLinkRow>(
    "SELECT * FROM orders WHERE external_order_id=$1 AND payment_method='tinkoff_link'",
    [externalId],
  )).rows[0];
  const existing = await lookup();
  if (existing) return replay(existing, fingerprint);
  const markedItem: OrderItem & { manualPaymentRequestFingerprint: string } = {
    ...item, manualPaymentRequestFingerprint: fingerprint,
  };
  try {
    // Both identity and fingerprint commit in the same existing order transaction.
    const created: ManualPaymentLinkRow = await createPendingOrderWithReservation({
      ...order, external_order_id: externalId, payment_method: "tinkoff_link",
    }, [markedItem]);
    return { order: created, created: true };
  } catch (error) {
    if ((error as { code?: string })?.code !== "23505") throw error;
    // The unique external_order_id index elects one Init owner across processes.
    const winner = await lookup();
    if (!winner) throw error;
    return replay(winner, fingerprint);
  }
}

