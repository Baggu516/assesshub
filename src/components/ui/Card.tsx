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
        'rounded-xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/60',
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
}: {
  label: string;
  value: string | number;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </Card>
  );
}
