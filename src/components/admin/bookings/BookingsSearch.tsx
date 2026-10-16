import { AdminInput } from '@/components/admin/ui';
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function BookingsSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--bs-muted)]" />
      <AdminInput
        type="text"
        placeholder="Поиск по имени или телефону..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 text-sm"
        aria-label="Поиск по заявкам"
      />
    </div>
  );
}
