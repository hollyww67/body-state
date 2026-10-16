import { AdminButton } from '@/components/admin/ui';
import type { BookingStatus } from "@/lib/api/bookings";

interface Props {
  filter: BookingStatus | "all";
  onFilterChange: (f: BookingStatus | "all") => void;
}

export default function BookingsFilters({ filter, onFilterChange }: Props) {
  const tabs: { value: BookingStatus | "all"; label: string }[] = [
    { value: "all", label: "Все" },
    {value:'new',label:'Новые заявки'},
    { value: "pending", label: "Ждут оплату" },
    { value: "confirmed", label: "Подтверждены" },
    { value: "cancelled", label: "Отмен." },
    { value: "completed", label: "Заверш." },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <AdminButton variant={filter === tab.value ? 'primary' : 'outline'}
          key={tab.value}
          aria-pressed={filter === tab.value}
          onClick={() => onFilterChange(tab.value)}
          size="sm"
        >
          {tab.label}
        </AdminButton>
      ))}
    </div>
  );
}
