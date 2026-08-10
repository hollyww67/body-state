import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { sendTelegramToClient } from "@/lib/notifications";

export async function GET() {
  const { data: bfm } = await supabaseAdmin.from("bfm_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, created_at, slot_id").order("created_at", { ascending: false });
  const { data: brt } = await supabaseAdmin.from("brt_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, created_at, slot_id").order("created_at", { ascending: false });
  const { data: psy } = await supabaseAdmin.from("psychology_bookings")
    .select("id, client_name, client_phone, client_email, client_tg, status, booking_type, room_id, created_at, slot_id").order("created_at", { ascending: false });
  const { data: program } = await supabaseAdmin.from("program_enrollments")
    .select("id, client_name, client_phone, notes, status, created_at").order("created_at", { ascending: false });
  const { data: consultation } = await supabaseAdmin.from("consultation_enrollments")
    .select("id, client_name, client_phone, notes, status, created_at").order("created_at", { ascending: false });

  const allSlots = await supabaseAdmin.from("slots").select("id, slot_time");
  const slotMap = new Map((allSlots.data || []).map((s: any) => [s.id, s.slot_time]));

  const mapBookings = (list: any[] | null, type: string) => {
    if (!list) return [];
    return list.map((b: any) => ({ ...b, service_type: type, slot_time: slotMap.get(b.slot_id) || null }));
  };

  const programBookings = (program || []).map((p: any) => ({ ...p, service_type: "program", slot_time: null }));
  const consultationBookings = (consultation || []).map((c: any) => ({ ...c, service_type: "consultation", slot_time: null }));

  const bookings = [
    ...mapBookings(bfm, "bfm"), ...mapBookings(brt, "brt"), ...mapBookings(psy, "psychology"),
    ...programBookings, ...consultationBookings,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ bookings });
}

export async function PATCH(request: NextRequest) {
  const { id, status } = await request.json();

  // program_enrollments
  const { data: programBooking } = await supabaseAdmin.from("program_enrollments").select("id").eq("id", id).single();
  if (programBooking) {
    await supabaseAdmin.from("program_enrollments").update({ status }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // consultation_enrollments
  const { data: consBooking } = await supabaseAdmin.from("consultation_enrollments").select("id").eq("id", id).single();
  if (consBooking) {
    await supabaseAdmin.from("consultation_enrollments").update({ status }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // bfm/brt/psychology
  for (const table of ["bfm_bookings", "brt_bookings", "psychology_bookings"]) {
    const { data } = await supabaseAdmin.from(table).update({ status }).eq("id", id).select("*").single();
    if (data) {
      if (status === "cancelled") {
        const { data: slot } = await supabaseAdmin.from("slots").select("slot_time").eq("id", data.slot_id).single();
        if (slot) await supabaseAdmin.from("slots").update({ is_booked: false }).eq("slot_time", slot.slot_time);
      }
      if (status === "confirmed" && data.client_tg) {
        const { data: slot } = await supabaseAdmin.from("slots").select("slot_time").eq("id", data.slot_id).single();
        const dateStr = slot ? new Date(slot.slot_time).toLocaleString("ru", { timeZone: "Europe/Moscow" }) : "";
        await sendTelegramToClient(data.client_tg, `✅ Запись подтверждена!\n\n${dateStr}`);
      }
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID обязателен" }, { status: 400 });

  for (const table of ["program_enrollments", "consultation_enrollments", "bfm_bookings", "brt_bookings", "psychology_bookings"]) {
    const { data: booking } = await supabaseAdmin.from(table).select("status").eq("id", id).single();
    if (booking) {
      if (booking.status !== "completed" && booking.status !== "cancelled") {
        return NextResponse.json({ error: "Можно удалять только завершённые или отменённые заявки" }, { status: 400 });
      }
      await supabaseAdmin.from(table).delete().eq("id", id);
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
}
