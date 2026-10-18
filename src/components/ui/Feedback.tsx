import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const icons = { success: CheckCircle2, warning: AlertTriangle, error: AlertCircle, information: Info };
export function Feedback({ tone = "information", children, className }: { tone?: keyof typeof icons; children: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cn("qp-feedback", `qp-feedback--${tone}`, className)}><Icon size={20} aria-hidden="true" /><div>{children}</div></div>;
}
export function LoadingState({ children = "Загружаем…" }: { children?: ReactNode }) {
  return <div role="status" className="qp-loading"><Loader2 size={20} aria-hidden="true" className="animate-spin" /><span>{children}</span></div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="ds-empty-state qp-empty"><h3>{title}</h3>{children && <p>{children}</p>}{action}</section>;
}
