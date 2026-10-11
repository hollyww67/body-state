"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  icon?: ReactNode;
  hint?: string;
  error?: string;
  optional?: boolean;
};

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, icon, hint, error, optional, className, type = "text", required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = `${inputId}-help`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="ds-field" htmlFor={inputId}>
      <span className="ds-field__label">
        <span>{label}</span>
        <span className="ds-field__requirement">{optional ? "Необязательно" : required ? "Обязательно" : ""}</span>
      </span>
      <span className={cn("ds-field__control", error && "is-error")}>
        {icon && <span className="ds-field__icon" aria-hidden="true">{icon}</span>}
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? helpId : undefined}
          className={cn("ds-field__input", icon && "has-icon", isPassword && "has-action", className)}
        />
        {isPassword && (
          <button
            type="button"
            className="ds-field__action"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Скрыть пароль" : "Показать пароль"}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </button>
        )}
      </span>
      {(error || hint) && <span id={helpId} className={cn("ds-field__help", error && "is-error")}>{error || hint}</span>}
    </label>
  );
});

export default TextField;
