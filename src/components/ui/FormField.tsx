import clsx from 'clsx';

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('space-y-1', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-slate-500 dark:text-slate-400"
      >
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      {hint && !error ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
