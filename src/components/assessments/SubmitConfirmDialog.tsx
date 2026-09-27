import { useEffect } from 'react';

export function SubmitConfirmDialog({
  open,
  answered,
  total,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  answered: number;
  total: number;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const unanswered = Math.max(0, total - answered);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-confirm-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
      >
        <h2 id="submit-confirm-title" className="text-lg font-bold text-slate-900 dark:text-white">
          Submit this test?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {unanswered > 0
            ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still unanswered. You can go back, or submit what you have.`
            : `All ${total} question${total === 1 ? '' : 's'} are answered. Submitting sends this attempt.`}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Keep working
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
