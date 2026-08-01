import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: 'sm' | 'md';
  hasError?: boolean;
};

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2.5 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = 'md', hasError, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-xl border bg-white text-slate-900 transition-colors',
        'placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'selection:bg-brand-100 selection:text-brand-900 dark:selection:bg-brand-500/30 dark:selection:text-brand-50',
        'autofill:shadow-[inset_0_0_0_1000px_white] dark:autofill:shadow-[inset_0_0_0_1000px_rgb(2_6_23)]',
        hasError
          ? 'border-rose-300 dark:border-rose-600 focus:ring-rose-500/40 focus:border-rose-500'
          : 'border-slate-200 dark:border-slate-600',
        sizeClasses[inputSize],
        className
      )}
      {...props}
    />
  );
});
