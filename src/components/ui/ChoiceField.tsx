"use client";

import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Help = { label: string; hint?: string; error?: string };

export function SelectField({ label, hint, error, children, id, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Help) {
  const generated = useId();
  const fieldId = id || generated;
  return <label className="ds-field" htmlFor={fieldId}>
    <span className="ds-field__label">{label}</span>
    <select {...props} id={fieldId} className={cn("ds-input qp-select", className)} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${fieldId}-help` : undefined}>{children}</select>
    {(hint || error) && <span id={`${fieldId}-help`} className={cn("ds-field__help", error && "is-error")}>{error || hint}</span>}
  </label>;
}

/** Native multi-select keeps platform keyboard and touch semantics. */
export function MultiSelectField(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple"> & Help) {
  return <SelectField {...props} multiple />;
}

export function TextareaField({ label, hint, error, id, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Help) {
  const generated = useId();
  const fieldId = id || generated;
  return <label className="ds-field" htmlFor={fieldId}>
    <span className="ds-field__label">{label}</span>
    <textarea {...props} id={fieldId} className={cn("ds-input qp-textarea", className)} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${fieldId}-help` : undefined} />
    {(hint || error) && <span id={`${fieldId}-help`} className={cn("ds-field__help", error && "is-error")}>{error || hint}</span>}
  </label>;
}

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & Help;
function Choice({ label, hint, error, className, id, type, role, ...props }: ChoiceProps & { type: "checkbox" | "radio"; role?: "switch" }) {
  const generated = useId();
  const fieldId = id || generated;
  return <label className={cn("qp-choice", role === "switch" && "qp-switch", className)} htmlFor={fieldId}>
    <input {...props} type={type} role={role} id={fieldId} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${fieldId}-help` : undefined} />
    <span><span className="qp-choice-label">{label}</span>{(hint || error) && <span id={`${fieldId}-help`} className={cn("ds-field__help", error && "is-error")}>{error || hint}</span>}</span>
  </label>;
}
export function CheckboxField(props: ChoiceProps) { return <Choice {...props} type="checkbox" />; }
export function RadioField(props: ChoiceProps) { return <Choice {...props} type="radio" />; }
export function SwitchField(props: ChoiceProps) { return <Choice {...props} type="checkbox" role="switch" />; }
