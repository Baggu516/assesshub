import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useAcademicYearsQuery,
  useAcademicYearMutations,
  type AcademicYear,
} from '@/hooks/api/useAcademicYears';

function YearFormModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
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

  useEffect(() => {
    if (!open) {
      setLabel('');
      setStartDate('');
      setEndDate('');
      setIsCurrent(false);
      return;
    }
    setLabel(initial?.label || '');
    setStartDate(initial?.startDate ? String(initial.startDate).slice(0, 10) : '');
    setEndDate(initial?.endDate ? String(initial.endDate).slice(0, 10) : '');
    setIsCurrent(Boolean(initial?.isCurrent));
  }, [open, initial]);

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
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title={initial ? 'Edit academic year' : 'New academic year'}
      description="Classes and enrollments are scoped to a year."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="year-form" disabled={!canSave || saving}>
            {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="year-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Label" htmlFor="year-label" required>
          <Input
            id="year-label"
            placeholder="e.g. 2025-26"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start date" htmlFor="year-start">
            <Input
              id="year-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="End date" htmlFor="year-end">
            <Input
              id="year-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
          />
          Set as current academic year
        </label>
      </form>
    </Modal>
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

      <YearFormModal
        key={editTarget?.id || 'new'}
        open={showForm}
        initial={editTarget}
        onClose={() => {
          setShowForm(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
        saving={create.isPending || update.isPending}
      />
    </div>
  );
}
