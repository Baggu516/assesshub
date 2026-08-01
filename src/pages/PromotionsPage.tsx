import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import {
  usePromotionMutations,
  type PromotionDecision,
  type PromotionPreview,
  type PromotionStudentRow,
} from '@/hooks/api/usePromotions';

type RowState = {
  action: 'promote' | 'retain' | 'skip';
  classMasterId: string;
  section: string;
  targetClassId: string;
};

function initRowState(s: PromotionStudentRow): RowState {
  if (s.alreadyEnrolledInTarget) {
    return { action: 'skip', classMasterId: '', section: '', targetClassId: '' };
  }
  return {
    action: s.suggestedAction,
    classMasterId: s.suggestedClassMasterId || '',
    section: s.suggestedSection || '',
    targetClassId: s.suggestedTargetClassId || '',
  };
}

export function PromotionsPage() {
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsQuery();
  const { preview, execute } = usePromotionMutations();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [data, setData] = useState<PromotionPreview | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );

  useEffect(() => {
    if (!fromId && sortedYears.length) {
      const current = sortedYears.find((y) => y.isCurrent) || sortedYears[0];
      setFromId(current.id);
    }
  }, [sortedYears, fromId]);

  const handlePreview = async () => {
    if (!fromId || !toId) {
      toast.error('Select both academic years');
      return;
    }
    try {
      const result = await preview.mutateAsync({
        fromAcademicYearId: fromId,
        toAcademicYearId: toId,
      });
      setData(result);
      const next: Record<string, RowState> = {};
      for (const s of result.students) {
        next[s.studentId] = initRowState(s);
      }
      setRows(next);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to load promotion preview');
    }
  };

  const updateRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  };

  const handleExecute = async () => {
    if (!data) return;
    const promotions: PromotionDecision[] = data.students.map((s) => {
      const r = rows[s.studentId] || initRowState(s);
      return {
        studentId: s.studentId,
        enrollmentId: s.enrollmentId,
        action: r.action,
        ...(r.targetClassId
          ? { targetClassId: r.targetClassId }
          : { classMasterId: r.classMasterId || undefined, section: r.section }),
      };
    });

    const active = promotions.filter((p) => p.action !== 'skip');
    if (!active.length) {
      toast.error('No students selected to promote or retain');
      return;
    }

    if (
      !window.confirm(
        `Promote/retain ${active.length} student(s) from ${data.fromYear.label} → ${data.toYear.label}? Old enrollments are kept.`
      )
    ) {
      return;
    }

    try {
      const result = await execute.mutateAsync({
        fromAcademicYearId: data.fromYear.id,
        toAcademicYearId: data.toYear.id,
        promotions,
      });
      toast.success(
        `Done: ${result.promoted} promoted, ${result.retained} retained, ${result.skipped} skipped`
      );
      if (result.errors?.length) {
        toast.error(`${result.errors.length} student(s) failed`);
      }
      await handlePreview();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Promotion failed');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Move students from one academic year to the next. History is preserved — new enrollments are created, old ones are never overwritten."
      />

      <Card className="p-4 space-y-4">
        {yearsLoading ? (
          <Skeleton className="h-10" />
        ) : (
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <label className="text-xs text-slate-500 space-y-1 block">
              <span>From year</span>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  setData(null);
                }}
              >
                <option value="">Select…</option>
                {sortedYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500 space-y-1 block">
              <span>To year</span>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value);
                  setData(null);
                }}
              >
                <option value="">Select…</option>
                {sortedYears
                  .filter((y) => y.id !== fromId)
                  .map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
              </select>
            </label>
            <Button onClick={handlePreview} disabled={preview.isPending || !fromId || !toId}>
              {preview.isPending ? 'Loading…' : 'Load students'}
            </Button>
          </div>
        )}
      </Card>

      {data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {data.students.length} enrolled student
              {data.students.length !== 1 ? 's' : ''} in {data.fromYear.label}
            </p>
            <Button onClick={handleExecute} disabled={execute.isPending || !data.students.length}>
              {execute.isPending ? 'Running…' : 'Promote students'}
            </Button>
          </div>

          {data.students.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              No active enrollments in {data.fromYear.label}.
            </Card>
          ) : (
            <div className="space-y-3">
              {data.students.map((s) => {
                const r = rows[s.studentId] || initRowState(s);
                return (
                  <Card key={s.studentId} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">{s.studentLabel}</h3>
                      <Badge tone="neutral">{s.fromClassName || 'No class'}</Badge>
                      {s.alreadyEnrolledInTarget ? (
                        <Badge tone="success">Already in {data.toYear.label}</Badge>
                      ) : null}
                    </div>
                    <div className="grid sm:grid-cols-4 gap-3">
                      <label className="text-xs text-slate-500 space-y-1 block">
                        <span>Action</span>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                          value={r.action}
                          disabled={s.alreadyEnrolledInTarget}
                          onChange={(e) =>
                            updateRow(s.studentId, {
                              action: e.target.value as RowState['action'],
                            })
                          }
                        >
                          <option value="promote">Promote</option>
                          <option value="retain">Keep same grade</option>
                          <option value="skip">Skip</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-500 space-y-1 block">
                        <span>Target grade</span>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                          value={r.classMasterId}
                          disabled={r.action === 'skip' || s.alreadyEnrolledInTarget}
                          onChange={(e) =>
                            updateRow(s.studentId, {
                              classMasterId: e.target.value,
                              targetClassId: '',
                            })
                          }
                        >
                          <option value="">Select…</option>
                          {data.classMasters.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-slate-500 space-y-1 block">
                        <span>Section</span>
                        <input
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                          placeholder="A"
                          value={r.section}
                          disabled={r.action === 'skip' || s.alreadyEnrolledInTarget}
                          onChange={(e) =>
                            updateRow(s.studentId, {
                              section: e.target.value,
                              targetClassId: '',
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-500 space-y-1 block">
                        <span>Or existing class</span>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                          value={r.targetClassId}
                          disabled={r.action === 'skip' || s.alreadyEnrolledInTarget}
                          onChange={(e) => updateRow(s.studentId, { targetClassId: e.target.value })}
                        >
                          <option value="">Create if missing</option>
                          {data.targetClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
