import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Card } from './Card';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          className={clsx(
            'pointer-events-auto relative flex max-h-[90vh] w-full animate-fade-up flex-col',
            maxW
          )}
        >
          <Card
            className={clsx(
              'flex max-h-[90vh] flex-col overflow-hidden border-slate-200/90 p-0 shadow-glow dark:border-slate-700',
              className
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800 sm:px-6">
                {footer}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>,
    document.body
  );
}
