import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAcademicYear } from '@/context/AcademicYearContext';

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function AcademicYearSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { sortedYears, yearId, setYearId, isLoading, label } = useAcademicYear();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isLoading && sortedYears.length === 0) return null;

  const items = [
    ...sortedYears.map((y) => ({
      id: y.id,
      label: y.label,
      current: y.isCurrent,
    })),
    { id: 'all', label: 'All years', current: false },
  ];

  return (
    <div ref={rootRef} className={clsx('relative', collapsed ? 'flex justify-center' : 'px-1 pb-1')}>
      {collapsed ? (
        <button
          type="button"
          aria-label="Academic year"
          aria-expanded={open}
          title={label ? `Academic year · ${label}` : 'Academic year'}
          disabled={isLoading || !yearId}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-200"
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={isLoading || !yearId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <CalendarIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Academic year
            </span>
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
              {isLoading || !label ? 'Loading…' : label}
            </span>
          </span>
          <svg
            className={clsx('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {open && (
        <div
          role="listbox"
          aria-label="Academic year"
          className={clsx(
            'absolute z-50 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900',
            collapsed ? 'bottom-full left-0 w-56' : 'bottom-full left-1 right-1'
          )}
        >
          {items.map((item) => {
            const selected = item.id === yearId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setYearId(item.id);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                  selected
                    ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                )}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.current ? (
                  <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
                    Current
                  </span>
                ) : null}
                {selected ? (
                  <svg className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
