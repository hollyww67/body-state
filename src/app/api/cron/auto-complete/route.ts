import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const DURATIONS: Record<string, number> = {
  bfm: 45,
  brt: 60,
  psychology: 90,
};

export async function GET() {
  const now = new Date();
  const completed: string[] = [];

  for (const table of ["bfm_bookings", "brt_bookings", "psychology_bookings"]) {
    const serviceType = table.replace("_bookings", "");
    const duration = DURATIONS[serviceType] || 60;

    const { data: bookings } = await supabaseAdmin
      .from(table)
      .select("id, client_name, slot_id")
      .eq("status", "confirmed");

    if (!bookings) continue;

    for (const booking of bookings) {
      const { data: slot } = await supabaseAdmin
        .from("slots")
        .select("slot_time")
        .eq("id", booking.slot_id)
        .single();

      if (!slot) continue;

      const slotTime = new Date(slot.slot_time);
      const endTime = new Date(slotTime.getTime() + duration * 60 * 1000);

      if (endTime <= now) {
        await supabaseAdmin
          .from(table)
          .update({ status: "completed" })
          .eq("id", booking.id);

        completed.push(`${serviceType}: ${booking.client_name}`);
      }
    }
  }

  return NextResponse.json({ ok: true, count: completed.length });
}
