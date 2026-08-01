import clsx from 'clsx';

const tones = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  brand: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
