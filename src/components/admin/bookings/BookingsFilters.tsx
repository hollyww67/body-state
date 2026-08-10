import type { BookingStatus } from "@/lib/api/bookings";

interface Props {
  filter: BookingStatus | "all";
  onFilterChange: (f: BookingStatus | "all") => void;
}

export default function BookingsFilters({ filter, onFilterChange }: Props) {
  const tabs: { value: BookingStatus | "all"; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "pending", label: "Новые" },
    { value: "confirmed", label: "Подтв." },
    { value: "cancelled", label: "Отмен." },
    { value: "completed", label: "Заверш." },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilterChange(tab.value)}
          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
            filter === tab.value
              ? "bg-[#0F766E] text-white shadow-sm"
              : "bg-white border border-gray-200 text-[#6B7280] hover:border-gray-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
