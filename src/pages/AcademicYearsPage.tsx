import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useAcademicYearsQuery,
  useAcademicYearMutations,
  type AcademicYear,
} from '@/hooks/api/useAcademicYears';

function YearFormModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: AcademicYear | null;
  onClose: () => void;
  onSave: (data: {
    label: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
  }) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(initial?.label || '');
  const [startDate, setStartDate] = useState(
    initial?.startDate ? String(initial.startDate).slice(0, 10) : ''
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate ? String(initial.endDate).slice(0, 10) : ''
  );
  const [isCurrent, setIsCurrent] = useState(initial?.isCurrent || false);

  const canSave = label.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    onSave({
      label: label.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      isCurrent,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-md w-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {initial ? 'Edit academic year' : 'New academic year'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Classes, enrollments, and promotions are scoped to a year (e.g. 2025-26).
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            placeholder="Label * (e.g. 2025-26)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-500 space-y-1">
              <span>Start date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500 space-y-1">
              <span>End date</span>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
            Set as current academic year
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AcademicYearsPage() {
  const { data: years = [], isLoading } = useAcademicYearsQuery();
  const { create, update, remove } = useAcademicYearMutations();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<AcademicYear | null>(null);

  const handleSave = async (form: {
    label: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
  }) => {
    try {
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, ...form });
        toast.success('Academic year updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Academic year created');
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save academic year');
    }
  };

  const handleDelete = async (year: AcademicYear) => {
    if (!window.confirm(`Archive academic year "${year.label}"?`)) return;
    try {
      await remove.mutateAsync(year.id);
      toast.success('Academic year archived');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to archive');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic years"
        description="Foundation for classes, enrollments, and promotions. Create years like 2025-26 before opening classes."
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
          >
            New year
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : years.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No academic years yet. Create 2025-26 (or your current year) to get started.
        </Card>
      ) : (
        <div className="space-y-3">
          {years.map((y) => (
            <Card key={y.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-slate-900 dark:text-white">{y.label}</h3>
                {y.isCurrent ? <Badge tone="success">Current</Badge> : null}
              </div>
              <div className="flex gap-2 shrink-0">
                {!y.isCurrent ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await update.mutateAsync({ id: y.id, isCurrent: true });
                        toast.success(`${y.label} set as current`);
                      } catch {
                        toast.error('Failed to set current year');
                      }
                    }}
                  >
                    Set current
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditTarget(y);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(y)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <YearFormModal
          key={editTarget?.id || 'new'}
          initial={editTarget}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          onSave={handleSave}
          saving={create.isPending || update.isPending}
        />
      ) : null}
    </div>
  );
}
