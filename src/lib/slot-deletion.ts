import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Delete availability only: booking references, including history, are protected. */
export async function deleteUnreferencedSlots(input: unknown) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 5000 ||
      input.some(id => typeof id !== "string" || !UUID.test(id))) {
    return { ok: false as const, status: 400, error: "Укажите от 1 до 5000 корректных id слотов" };
  }
  const ids = [...new Set(input.map(id => id.toLowerCase()))];
  return db.transaction(async client => {
    // Same lock/order as claim, reschedule and cancellation; no network work here.
    await client.query("SELECT pg_advisory_xact_lock($1)", [913202609]);
    await client.query("SELECT id FROM slots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [ids]);
    const references = await client.query(`
      SELECT 1 FROM (
        SELECT slot_id FROM bfm_bookings WHERE slot_id=ANY($1::uuid[])
        UNION ALL SELECT slot_id FROM brt_bookings WHERE slot_id=ANY($1::uuid[])
        UNION ALL SELECT slot_id FROM psychology_bookings WHERE slot_id=ANY($1::uuid[])
        UNION ALL SELECT old_slot_id FROM booking_events WHERE old_slot_id=ANY($1::uuid[])
        UNION ALL SELECT new_slot_id FROM booking_events WHERE new_slot_id=ANY($1::uuid[])
      ) protected LIMIT 1`, [ids]);
    if (references.rowCount) {
      return { ok: false as const, status: 409,
        error: "Удаление отменено: один из слотов связан с записью клиента, в том числе отменённой или завершённой. История приёмов должна сохраняться." };
    }
    const deleted = await client.query("DELETE FROM slots WHERE id=ANY($1::uuid[]) RETURNING id", [ids]);
    return { ok: true as const, count: deleted.rowCount ?? 0 };
  });
}
