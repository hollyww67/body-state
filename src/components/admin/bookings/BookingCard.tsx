import { AdminButton, AdminCard, AdminBadge } from '@/components/admin/ui';
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { X, Video, Trash2 } from "lucide-react";
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
    <AdminCard>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <AdminBadge>
              {TYPE_LABELS[booking.service_type]}
            </AdminBadge>
            {booking.booking_type === "online" && (
              <AdminBadge tone="info">Онлайн</AdminBadge>
            )}
            <span className="text-xs text-[var(--bs-muted)]">{date}</span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="font-semibold text-sm text-[var(--bs-foreground)]">{booking.client_name}</p>
          <p className="text-xs text-[var(--bs-muted)]">{booking.client_phone}</p>
          {(booking.client_email || booking.client_tg) && (
            <p className="text-xs text-[var(--bs-muted)] mt-0.5 truncate">{booking.client_email}{booking.client_tg}</p>
          )}
          {booking.room_id && (
            <p className="text-xs text-[var(--bs-info)] mt-0.5 font-mono">Комната: {booking.room_id}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {booking.status === "confirmed" && booking.booking_type === "online" && booking.room_id && (
            <AdminButton variant="ghost" size="icon" onClick={() => router.push(`/psychology/room?id=${booking.room_id}&role=doctor`)} aria-label="Войти в комнату" title="Войти в комнату">
              <Video className="w-4 h-4" />
            </AdminButton>
          )}
          {booking.status === "pending" && (
              <AdminButton variant="destructive" size="icon" onClick={() => onStatusChange(booking.id, "cancelled")} disabled={isUpdating} aria-label="Отменить">
                <X className="w-4 h-4" />
              </AdminButton>
          )}
          {booking.status === "confirmed" && (
            <AdminButton variant="ghost" onClick={() => onStatusChange(booking.id, "completed")} disabled={isUpdating}
              className="text-xs flex-shrink-0">
              {isUpdating ? "..." : "Завершить"}
            </AdminButton>
          )}
          {canDelete && onDelete && (
            <AdminButton variant="destructive" size="icon" onClick={() => onDelete(booking.id)} disabled={isUpdating}
              aria-label="Удалить заявку" title="Удалить">
              <Trash2 className="w-4 h-4" />
            </AdminButton>
          )}
        </div>
      </div>
    </AdminCard>
  );
}
