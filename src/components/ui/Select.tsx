import clsx from 'clsx';
import { forwardRef, type SelectHTMLAttributes } from 'react';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  inputSize?: 'sm' | 'md';
};

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2.5 text-sm',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, inputSize = 'md', children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={clsx(
        'w-full rounded-lg border border-slate-200 bg-white text-slate-900',
        'dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses[inputSize],
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
