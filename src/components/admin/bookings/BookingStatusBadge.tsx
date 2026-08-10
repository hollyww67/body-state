import type { BookingStatus } from "@/lib/api/bookings";
import { STATUS_LABELS } from "@/lib/api/bookings";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-600",
};

export default function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
