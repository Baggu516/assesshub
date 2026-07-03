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
        'w-full rounded-lg border bg-white text-slate-900 transition-colors',
        'placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
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
