import { Minus, Plus } from "lucide-react";

interface QuantityControlProps {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

export default function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
}: QuantityControlProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
      <button
        onClick={onDecrease}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--primary-muted)]"
        aria-label="Уменьшить количество"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold text-[var(--foreground)]">{quantity}</span>
      <button
        onClick={onIncrease}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--primary-muted)]"
        aria-label="Увеличить количество"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
