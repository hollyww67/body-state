import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function BookingsSearch({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
      <input
        type="text"
        placeholder="Поиск по имени или телефону..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        aria-label="Поиск по заявкам"
      />
    </div>
  );
}
