import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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

const controlClass = 'rounded-xl';

const ACTION_LABEL = {
  promote: 'Promote',
  retain: 'Keep same grade',
  skip: 'Skip',
} as const;

function Count({
  value,
  label,
  tone = 'neutral',
}: {
  value: number;
  label: string;
  tone?: 'neutral' | 'brand' | 'success';
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    brand: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100',
    success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  };
  return (
    <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', tones[tone])}>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RuleFields({
  idPrefix,
  value,
  disabled,
  classMasters,
  targetClasses,
  onChange,
  layout,
}: {
  idPrefix: string;
  value: RowState;
  disabled: boolean;
  classMasters: PromotionPreview['classMasters'];
  targetClasses: PromotionPreview['targetClasses'];
  onChange: (patch: Partial<RowState>) => void;
  layout: 'grid' | 'cells';
}) {
  const locked = disabled || value.action === 'skip';
  const action = (
    <Select
      id={`${idPrefix}-action`}
      className={controlClass}
      value={value.action}
      disabled={disabled}
      onChange={(e) => onChange({ action: e.target.value as RowState['action'] })}
    >
      <option value="promote">Promote</option>
      <option value="retain">Keep same grade</option>
      <option value="skip">Skip</option>
    </Select>
  );
  const grade = (
    <Select
      id={`${idPrefix}-grade`}
      className={controlClass}
      value={value.classMasterId}
      disabled={locked}
      onChange={(e) => onChange({ classMasterId: e.target.value, targetClassId: '' })}
    >
      <option value="">Select…</option>
      {classMasters.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </Select>
  );
  const section = (
    <Input
      id={`${idPrefix}-section`}
      className={controlClass}
      placeholder="A"
      value={value.section}
      disabled={locked}
      onChange={(e) => onChange({ section: e.target.value, targetClassId: '' })}
    />
  );
  const existing = (
    <Select
      id={`${idPrefix}-class`}
      className={controlClass}
      value={value.targetClassId}
      disabled={locked}
      onChange={(e) => onChange({ targetClassId: e.target.value })}
    >
      <option value="">Create if missing</option>
      {targetClasses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );

  if (layout === 'cells') {
    return (
      <>
        <td className="px-3 py-3 align-middle">{action}</td>
        <td className="px-3 py-3 align-middle">{grade}</td>
        <td className="w-28 px-3 py-3 align-middle">{section}</td>
        <td className="px-3 py-3 align-middle">{existing}</td>
      </>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FormField label="Action" htmlFor={`${idPrefix}-action`}>
        {action}
      </FormField>
      <FormField label="Target grade" htmlFor={`${idPrefix}-grade`}>
        {grade}
      </FormField>
      <FormField label="Section" htmlFor={`${idPrefix}-section`}>
        {section}
      </FormField>
      <FormField label="Existing class" htmlFor={`${idPrefix}-class`}>
        {existing}
      </FormField>
    </div>
  );
}

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

  const summary = useMemo(() => {
    if (!data) return null;
    let promote = 0;
    let retain = 0;
    let already = 0;
    for (const s of data.students) {
      if (s.alreadyEnrolledInTarget) {
        already += 1;
        continue;
      }
      const action = rows[s.studentId]?.action || 'skip';
      if (action === 'promote') promote += 1;
      else if (action === 'retain') retain += 1;
    }
    return {
      promote,
      retain,
      already,
      moving: promote + retain,
      total: data.students.length,
      classes: classGroups.length,
    };
  }, [data, rows, classGroups.length]);

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
        description="Set one rule per class, then open a student only when they need something different. Previous enrollments stay on record."
      />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-brand-400/15 blur-3xl" />
        {yearsLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="grid flex-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <FormField label="From year" htmlFor="promo-from-year">
                <Select
                  id="promo-from-year"
                  className={controlClass}
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
                </Select>
              </FormField>
              <div className="hidden h-11 items-center justify-center text-slate-300 dark:text-slate-600 sm:flex" aria-hidden>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.69l-3.22-3.22a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <FormField label="To year" htmlFor="promo-to-year">
                <Select
                  id="promo-to-year"
                  className={controlClass}
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
                </Select>
              </FormField>
            </div>
            <Button
              className="w-full shrink-0 lg:w-auto"
              onClick={handlePreview}
              disabled={preview.isPending || !fromId || !toId}
            >
              {preview.isPending ? 'Loading…' : 'Load students'}
            </Button>
          </div>
        )}
      </Card>

      {data && summary ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-card dark:border-slate-700/80 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-2">
              <Count value={summary.total} label={summary.total === 1 ? 'student' : 'students'} />
              <Count value={summary.classes} label={summary.classes === 1 ? 'class' : 'classes'} />
              <Count value={summary.moving} label="to move" tone="brand" />
              {summary.already ? (
                <Count value={summary.already} label={`already in ${data.toYear.label}`} tone="success" />
              ) : null}
            </div>
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={handleExecute}
              disabled={execute.isPending || summary.moving === 0}
            >
              {execute.isPending ? 'Running…' : 'Promote students'}
            </Button>
          </div>

          {data.students.length === 0 ? (
            <Card>
              <EmptyState
                title={`No enrollments in ${data.fromYear.label}`}
                description="Students appear here once they are enrolled in a class for that year."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {classGroups.map((group) => {
                const bulk = bulkByClass[group.key] || initBulkFromStudents(group.students);
                const eligibleCount = group.students.filter((s) => !s.alreadyEnrolledInTarget).length;
                const expanded = expandedClasses[group.key] ?? false;
                const done = eligibleCount === 0;

                return (
                  <Card key={group.key} className="!p-0 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                            {group.fromClassName}
                          </h3>
                          {!done ? (
                            <Badge
                              tone={
                                bulk.action === 'promote' ? 'brand' : bulk.action === 'retain' ? 'warning' : 'neutral'
                              }
                            >
                              {ACTION_LABEL[bulk.action]}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="neutral">
                            {group.students.length} student{group.students.length !== 1 ? 's' : ''}
                          </Badge>
                          {eligibleCount < group.students.length ? (
                            <Badge tone="success">
                              {group.students.length - eligibleCount} already in {data.toYear.label}
                            </Badge>
                          ) : null}
                        </div>
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
                        <Chevron open={expanded} />
                      </Button>
                    </div>

                    <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                      {done ? (
                        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                          Everyone in this class is already enrolled in {data.toYear.label}.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Apply to the whole class</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                              Suggestions are already filled in. Apply the rule, then open students only for exceptions.
                            </p>
                          </div>
                          <RuleFields
                            idPrefix={`bulk-${group.key}`}
                            layout="grid"
                            value={bulk}
                            disabled={false}
                            classMasters={data.classMasters}
                            targetClasses={data.targetClasses}
                            onChange={(patch) => updateBulk(group.key, patch)}
                          />
                          <div className="flex justify-end">
                            <Button variant="secondary" onClick={() => applyToClass(group)}>
                              Apply to class
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {expanded ? (
                      <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950/40">
                            <tr>
                              <th className="px-5 py-3 font-semibold">Student</th>
                              <th className="px-3 py-3 font-semibold">Action</th>
                              <th className="px-3 py-3 font-semibold">Target grade</th>
                              <th className="px-3 py-3 font-semibold">Section</th>
                              <th className="px-3 py-3 font-semibold">Existing class</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.students.map((s) => {
                              const r = rows[s.studentId] || initRowState(s);
                              return (
                                <tr key={s.studentId} className={s.alreadyEnrolledInTarget ? 'bg-slate-50/60 dark:bg-slate-950/30' : undefined}>
                                  <td className="px-5 py-3 align-middle">
                                    <p className="font-medium text-slate-900 dark:text-white">{s.studentLabel}</p>
                                    {s.alreadyEnrolledInTarget ? (
                                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                                        Already in {data.toYear.label}
                                      </p>
                                    ) : null}
                                  </td>
                                  <RuleFields
                                    idPrefix={`row-${s.studentId}`}
                                    layout="cells"
                                    value={r}
                                    disabled={s.alreadyEnrolledInTarget}
                                    classMasters={data.classMasters}
                                    targetClasses={data.targetClasses}
                                    onChange={(patch) => updateRow(s.studentId, patch)}
                                  />
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
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
