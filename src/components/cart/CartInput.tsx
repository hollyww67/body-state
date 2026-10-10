import { LucideIcon } from "lucide-react";

interface CartInputProps {
  icon: LucideIcon;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export default function CartInput({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
}: CartInputProps) {
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-dark w-full"
      />
    </div>
  );
}
