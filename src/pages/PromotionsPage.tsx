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

type ClassBulkState = {
  action: 'promote' | 'retain' | 'skip';
  classMasterId: string;
  section: string;
  targetClassId: string;
};

type ClassGroup = {
  key: string;
  fromClassId: string | null;
  fromClassName: string;
  students: PromotionStudentRow[];
};

const selectClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900';

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

function initBulkFromStudents(students: PromotionStudentRow[]): ClassBulkState {
  const sample = students.find((s) => !s.alreadyEnrolledInTarget) || students[0];
  if (!sample || sample.alreadyEnrolledInTarget) {
    return { action: 'skip', classMasterId: '', section: '', targetClassId: '' };
  }
  return {
    action: sample.suggestedAction,
    classMasterId: sample.suggestedClassMasterId || '',
    section: sample.suggestedSection || '',
    targetClassId: sample.suggestedTargetClassId || '',
  };
}

function groupByClass(students: PromotionStudentRow[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>();
  for (const s of students) {
    const key = s.fromClassId || `__none__:${s.fromClassName || 'none'}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        fromClassId: s.fromClassId,
        fromClassName: s.fromClassName || 'No class',
        students: [],
      };
      map.set(key, group);
    }
    group.students.push(s);
  }
  return [...map.values()].sort((a, b) => a.fromClassName.localeCompare(b.fromClassName));
}

export function PromotionsPage() {
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsQuery();
  const { preview, execute } = usePromotionMutations();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [data, setData] = useState<PromotionPreview | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulkByClass, setBulkByClass] = useState<Record<string, ClassBulkState>>({});
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );

  const classGroups = useMemo(
    () => (data ? groupByClass(data.students) : []),
    [data]
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

      const nextRows: Record<string, RowState> = {};
      for (const s of result.students) {
        nextRows[s.studentId] = initRowState(s);
      }
      setRows(nextRows);

      const groups = groupByClass(result.students);
      const nextBulk: Record<string, ClassBulkState> = {};
      const nextExpanded: Record<string, boolean> = {};
      for (const g of groups) {
        nextBulk[g.key] = initBulkFromStudents(g.students);
        nextExpanded[g.key] = false;
      }
      setBulkByClass(nextBulk);
      setExpandedClasses(nextExpanded);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to load promotion preview');
    }
  };

  const updateRow = (studentId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  };

  const updateBulk = (classKey: string, patch: Partial<ClassBulkState>) => {
    setBulkByClass((prev) => ({ ...prev, [classKey]: { ...prev[classKey], ...patch } }));
  };

  const applyToClass = (group: ClassGroup) => {
    const bulk = bulkByClass[group.key];
    if (!bulk) return;

    const eligible = group.students.filter((s) => !s.alreadyEnrolledInTarget);
    if (!eligible.length) {
      toast.error('All students in this class are already enrolled in the target year');
      return;
    }
    if (bulk.action !== 'skip' && !bulk.targetClassId && !bulk.classMasterId) {
      toast.error('Select a target grade or existing class');
      return;
    }

    setRows((prev) => {
      const next = { ...prev };
      for (const s of eligible) {
        next[s.studentId] = {
          action: bulk.action,
          classMasterId: bulk.classMasterId,
          section: bulk.section,
          targetClassId: bulk.targetClassId,
        };
      }
      return next;
    });

    toast.success(`Applied to ${eligible.length} student(s) in ${group.fromClassName}`);
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
        description="Promote by class: set rules once per class, then adjust individual students if needed. History is preserved — old enrollments are never overwritten."
      />

      <Card className="p-4 space-y-4">
        {yearsLoading ? (
          <Skeleton className="h-10" />
        ) : (
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <label className="text-xs text-slate-500 space-y-1 block">
              <span>From year</span>
              <select
                className={selectClass}
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
                className={selectClass}
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
              {classGroups.length ? ` · ${classGroups.length} class${classGroups.length !== 1 ? 'es' : ''}` : ''}
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
            <div className="space-y-4">
              {classGroups.map((group) => {
                const bulk = bulkByClass[group.key] || initBulkFromStudents(group.students);
                const eligibleCount = group.students.filter((s) => !s.alreadyEnrolledInTarget).length;
                const expanded = expandedClasses[group.key] ?? false;

                return (
                  <Card key={group.key} className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {group.fromClassName}
                        </h3>
                        <Badge tone="neutral">
                          {group.students.length} student{group.students.length !== 1 ? 's' : ''}
                        </Badge>
                        {eligibleCount < group.students.length ? (
                          <Badge tone="success">
                            {group.students.length - eligibleCount} already in {data.toYear.label}
                          </Badge>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedClasses((prev) => ({
                            ...prev,
                            [group.key]: !expanded,
                          }))
                        }
                      >
                        {expanded ? 'Hide students' : 'Show students'}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3 space-y-3">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Apply to whole class
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <label className="text-xs text-slate-500 space-y-1 block">
                          <span>Action</span>
                          <select
                            className={selectClass}
                            value={bulk.action}
                            disabled={!eligibleCount}
                            onChange={(e) =>
                              updateBulk(group.key, {
                                action: e.target.value as ClassBulkState['action'],
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
                            className={selectClass}
                            value={bulk.classMasterId}
                            disabled={!eligibleCount || bulk.action === 'skip'}
                            onChange={(e) =>
                              updateBulk(group.key, {
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
                            className={selectClass}
                            placeholder="A"
                            value={bulk.section}
                            disabled={!eligibleCount || bulk.action === 'skip'}
                            onChange={(e) =>
                              updateBulk(group.key, {
                                section: e.target.value,
                                targetClassId: '',
                              })
                            }
                          />
                        </label>
                        <label className="text-xs text-slate-500 space-y-1 block">
                          <span>Or existing class</span>
                          <select
                            className={selectClass}
                            value={bulk.targetClassId}
                            disabled={!eligibleCount || bulk.action === 'skip'}
                            onChange={(e) =>
                              updateBulk(group.key, { targetClassId: e.target.value })
                            }
                          >
                            <option value="">Create if missing</option>
                            {data.targetClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          variant="secondary"
                          disabled={!eligibleCount}
                          onClick={() => applyToClass(group)}
                        >
                          Apply to class
                        </Button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="space-y-3">
                        {group.students.map((s) => {
                          const r = rows[s.studentId] || initRowState(s);
                          return (
                            <div
                              key={s.studentId}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-medium text-slate-900 dark:text-white">
                                  {s.studentLabel}
                                </h4>
                                {s.alreadyEnrolledInTarget ? (
                                  <Badge tone="success">Already in {data.toYear.label}</Badge>
                                ) : null}
                              </div>
                              <div className="grid sm:grid-cols-4 gap-3">
                                <label className="text-xs text-slate-500 space-y-1 block">
                                  <span>Action</span>
                                  <select
                                    className={selectClass}
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
                                    className={selectClass}
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
                                    className={selectClass}
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
                                    className={selectClass}
                                    value={r.targetClassId}
                                    disabled={r.action === 'skip' || s.alreadyEnrolledInTarget}
                                    onChange={(e) =>
                                      updateRow(s.studentId, { targetClassId: e.target.value })
                                    }
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
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Defaults are pre-filled from suggestions. Use <strong>Apply to class</strong>, then
                        open students only for exceptions.
                      </p>
                    )}
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
