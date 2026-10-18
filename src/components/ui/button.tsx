import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "ds-primary-button hover:-translate-y-0.5",
        outline: "ds-secondary-button hover:-translate-y-0.5",
        ghost: "hover:bg-[var(--primary-muted)]",
        secondary: "ds-secondary-button",
        tertiary: "qp-button-tertiary",
        text: "qp-button-text",
        destructive: "qp-button-destructive",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", loading, disabled, children, ...props }, ref) => (
  <button type={type} className={cn(buttonVariants({ variant, size, className }))} data-size={size || "default"} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}{children}
  </button>
));
Button.displayName = "Button";

export { Button, buttonVariants };
