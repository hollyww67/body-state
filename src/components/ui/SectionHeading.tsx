export default function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center lg:mb-16">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--primary)' }}>{eyebrow}</p>
      <h2 className="text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-4xl" style={{ color: 'var(--foreground)' }}>{title}</h2>
      {subtitle && <p className="mt-5 text-base leading-relaxed md:text-lg" style={{ color: 'var(--foreground-secondary)' }}>{subtitle}</p>}
    </div>
  );
}
