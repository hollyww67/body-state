import type { BookingStatus } from "@/lib/api/bookings";
import { STATUS_LABELS } from "@/lib/api/bookings";
import { AdminBadge, type BadgeTone } from '@/components/admin/ui';

const STATUS_TONES: Record<BookingStatus, BadgeTone> = {
  new: 'info', pending: 'warning', confirmed: 'success', cancelled: 'destructive', completed: 'neutral',
};

export default function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <AdminBadge tone={STATUS_TONES[status]}>
      {STATUS_LABELS[status]}
    </AdminBadge>
  );
}
