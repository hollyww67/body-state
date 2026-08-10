import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Check, X, Video, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/lib/api/bookings";
import { TYPE_LABELS } from "@/lib/api/bookings";
import BookingStatusBadge from "./BookingStatusBadge";

interface Props {
  booking: Booking;
  updatingId: string | null;
  onStatusChange: (id: string, status: Booking["status"]) => void;
  onDelete?: (id: string) => void;
}

const DELETABLE_STATUSES = ["completed", "cancelled"];

export default function BookingCard({ booking, updatingId, onStatusChange, onDelete }: Props) {
  const router = useRouter();
  const isUpdating = updatingId === booking.id;
  const canDelete = DELETABLE_STATUSES.includes(booking.status);
  const date = booking.slot_time ? (() => { try { return format(parseISO(booking.slot_time), "d MMM, HH:mm", { locale: ru }); } catch { return "—"; } })() : "—";

  return (
    <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-3 md:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#D9F3EF] text-[#0F766E]">
              {TYPE_LABELS[booking.service_type]}
            </span>
            {booking.booking_type === "online" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Онлайн</span>
            )}
            <span className="text-xs text-[#6B7280]">{date}</span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="font-semibold text-sm text-[#111827]">{booking.client_name}</p>
          <p className="text-xs text-[#6B7280]">{booking.client_phone}</p>
          {(booking.client_email || booking.client_tg) && (
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">{booking.client_email}{booking.client_tg}</p>
          )}
          {booking.room_id && (
            <p className="text-xs text-blue-600 mt-0.5 font-mono">Комната: {booking.room_id}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {booking.status === "confirmed" && booking.booking_type === "online" && booking.room_id && (
            <button onClick={() => router.push(`/psychology/room?id=${booking.room_id}&role=doctor`)}
              className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" aria-label="Войти в комнату" title="Войти в комнату">
              <Video className="w-4 h-4" />
            </button>
          )}
          {booking.status === "pending" && (
            <>
              <button onClick={() => onStatusChange(booking.id, "confirmed")} disabled={isUpdating}
                className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50" aria-label="Подтвердить">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => onStatusChange(booking.id, "cancelled")} disabled={isUpdating}
                className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50" aria-label="Отменить">
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {booking.status === "confirmed" && (
            <button onClick={() => onStatusChange(booking.id, "completed")} disabled={isUpdating}
              className="text-xs text-[#0F766E] hover:underline flex-shrink-0 disabled:opacity-50">
              {isUpdating ? "..." : "Завершить"}
            </button>
          )}
          {canDelete && onDelete && (
            <button onClick={() => onDelete(booking.id)} disabled={isUpdating}
              className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors disabled:opacity-50"
              aria-label="Удалить заявку" title="Удалить">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
