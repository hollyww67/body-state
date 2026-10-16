import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
};
export const AdminButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function AdminButton(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...props }, ref,
) {
  return <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    className={cn('bs-button', `bs-button--${variant}`, `bs-button--${size}`, className)}>
    {loading && <LoaderCircle size={16} className="bs-spinner" aria-hidden="true" />}{children}
  </button>;
});
export const AdminInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function AdminInput({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={cn('bs-input', className)} />;
});
export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(function AdminTextarea({ className, ...props }, ref) {
  return <textarea {...props} ref={ref} className={cn('bs-input bs-textarea', className)} />;
});
export const AdminSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function AdminSelect({ className, ...props }, ref) {
  return <select {...props} ref={ref} className={cn('bs-input bs-select', className)} />;
});
/** Explicit IDs keep labels/help/errors associated on both server and client. */
export function AdminField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="bs-field"><label htmlFor={id}>{label}</label>{children}
    {(hint || error) && <p id={`${id}-description`} className={error ? 'bs-field-error' : 'bs-field-hint'} role={error ? 'alert' : undefined}>{error || hint}</p>}
  </div>;
}
export function AdminCard({ className, ...props }: React.ComponentProps<'section'>) {
  return <section {...props} className={cn('bs-card', className)} />;
}
export type BadgeTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';
export function AdminBadge({ tone = 'neutral', className, children, ...props }: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return <span {...props} className={cn('bs-badge', `bs-badge--${tone}`, className)}><span className="bs-badge-dot" aria-hidden="true" />{children}</span>;
}
export function AdminSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div {...props} aria-hidden="true" className={cn('bs-skeleton', className)} />;
}
export function AdminEmptyState({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return <div className="bs-empty"><h3>{title}</h3>{description && <p>{description}</p>}{children}</div>;
}
export function AdminStatCard({ title, value }: { title: string; value: React.ReactNode }) {
  return <AdminCard className="bs-stat"><p>{title}</p><strong>{value}</strong></AdminCard>;
}
export const AdminCheckbox = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<'input'>, 'type'>>(function AdminCheckbox({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="checkbox" className={cn('bs-check', className)} />;
});
export const AdminRadio = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<'input'>, 'type'>>(function AdminRadio({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="radio" className={cn('bs-check', className)} />;
});
/** Native checkbox semantics, including Space and form submission. Label supplied by consumer. */
export const AdminSwitch = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<'input'>, 'type' | 'role'>>(function AdminSwitch({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="checkbox" role="switch" className={cn('bs-switch', className)} />;
});
export function AdminTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  return <div className="bs-table-scroll" role="region" aria-label={caption} tabIndex={0}><table className="bs-table"><caption className="sr-only">{caption}</caption>{children}</table></div>;
}
export function AdminFeedback({ tone = 'info', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <div className={`bs-feedback bs-badge--${tone}`} role={tone === 'destructive' ? 'alert' : 'status'}>{children}</div>;
}
export function AdminPageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return <header className="bs-page-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children && <div className="bs-toolbar">{children}</div>}</header>;
}
export function AdminLoadingState({ children = 'Загрузка…' }: { children?: React.ReactNode }) {
  return <div className="bs-loading" role="status"><LoaderCircle className="bs-spinner" size={20} aria-hidden="true" /><span>{children}</span></div>;
}
