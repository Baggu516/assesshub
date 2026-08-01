import clsx from 'clsx';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-card backdrop-blur-sm',
        'dark:border-slate-700/80 dark:bg-slate-900/70',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardStat({
  label,
  value,
  hint,
  children,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  children?: React.ReactNode;
  accent?: 'brand' | 'success' | 'warning' | 'neutral';
}) {
  const bar =
    accent === 'success'
      ? 'from-emerald-500 to-teal-400'
      : accent === 'warning'
        ? 'from-amber-500 to-orange-400'
        : accent === 'neutral'
          ? 'from-slate-400 to-slate-300'
          : 'from-brand-500 to-cyan-400';

  return (
    <Card className="relative overflow-hidden">
      <div className={clsx('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', bar)} aria-hidden />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </Card>
  );
}
