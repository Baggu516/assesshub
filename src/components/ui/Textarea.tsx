import clsx from 'clsx';
import { forwardRef, type TextareaHTMLAttributes } from 'react';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 resize-y min-h-[88px]',
        'placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        hasError
          ? 'border-rose-300 dark:border-rose-600'
          : 'border-slate-200 dark:border-slate-600',
        className
      )}
      {...props}
    />
  );
});
