export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type ServiceType = "bfm" | "brt" | "psychology" | "program" | "consultation";
export type BookingType = "online" | "offline";

export interface Booking {
  id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  client_tg?: string;
  slot_time: string | null;
  service_type: ServiceType;
  status: BookingStatus;
  booking_type?: BookingType;
  room_id?: string;
  notes?: string;
  created_at: string;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Новая",
  confirmed: "Подтв.",
  cancelled: "Отмен.",
  completed: "Заверш.",
};

export const TYPE_LABELS: Record<string, string> = {
  bfm: "БФМ",
  brt: "БРТ",
  psychology: "Психология",
  program: "Программа",
  consultation: "Консультация",
};

export async function getBookings(signal?: AbortSignal): Promise<Booking[]> {
  const res = await fetch("/api/admin/bookings", { signal });
  if (!res.ok) throw new Error("Ошибка загрузки");
  const data = await res.json();
  return data.bookings || [];
}

export async function patchBooking(id: string, status: BookingStatus): Promise<void> {
  const res = await fetch("/api/admin/bookings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error("Ошибка обновления");
}
