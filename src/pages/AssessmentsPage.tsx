import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import {
  useAssessmentsQuery,
  useAssessmentAssignmentSummaryQuery,
  useAssessmentMutations,
  type Assessment,
  type ExamKind,
} from '@/hooks/api/useAssessments';
import { useStudentGroupsQuery } from '@/hooks/api/useStudentGroups';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import { resolveOrgFeatures } from '@/lib/sessionCache';
import {
  CreateWithAiModal,
  type AiAssessmentDraft,
} from '@/components/assessments/CreateWithAiModal';

const selectClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900';

function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function AssignModal({
  open,
  assessment,
  onClose,
  onAssign,
  saving,
}: {
  open: boolean;
  assessment: Assessment;
  onClose: () => void;
  onAssign: (groupIds: string[], dueDate: string | null, academicYearId: string) => void;
  saving: boolean;
}) {
  const { data: groups = [], isLoading } = useStudentGroupsQuery();
  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsQuery();
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');
  const [initialDueDate, setInitialDueDate] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [hydratedKey, setHydratedKey] = useState('');

  useEffect(() => {
    if (academicYearId || !sortedYears.length) return;
    const current = sortedYears.find((y) => y.isCurrent) || sortedYears[0];
    setAcademicYearId(current.id);
  }, [sortedYears, academicYearId]);

  const { data: summary, isLoading: summaryLoading } = useAssessmentAssignmentSummaryQuery(
    assessment.id,
    academicYearId || undefined,
    open && Boolean(academicYearId)
  );

  const alreadyAssignedGroupIds = useMemo(
    () => new Set(summary?.assignedGroupIds || []),
    [summary]
  );

  useEffect(() => {
    if (!open || !academicYearId || !summary) return;
    const key = `${assessment.id}:${academicYearId}:${summary.totalAssigned}:${(summary.assignedGroupIds || []).join(',')}`;
    if (key === hydratedKey) return;
    setSelected(new Set(summary.assignedGroupIds || []));
    const due = toDatetimeLocalValue(summary.dueDate);
    setDueDate(due);
    setInitialDueDate(due);
    setHydratedKey(key);
  }, [open, academicYearId, summary, assessment.id, hydratedKey]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setDueDate('');
      setInitialDueDate('');
      setHydratedKey('');
      setAcademicYearId('');
    }
  }, [open]);

  const selectedStudentCount = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      if (selected.has(g.id) || alreadyAssignedGroupIds.has(g.id)) {
        for (const sid of g.studentIds) ids.add(sid);
      }
    }
    return ids.size;
  }, [groups, selected, alreadyAssignedGroupIds]);

  const newStudentCount = useMemo(() => {
    const already = new Set(summary?.assignedStudentIds || []);
    const ids = new Set<string>();
    for (const g of groups) {
      if (!selected.has(g.id) && !alreadyAssignedGroupIds.has(g.id)) continue;
      for (const sid of g.studentIds) {
        if (!already.has(sid)) ids.add(sid);
      }
    }
    return ids.size;
  }, [groups, selected, summary, alreadyAssignedGroupIds]);

  const dueDateChanged = dueDate !== initialDueDate;

  const toggle = (id: string) => {
    if (alreadyAssignedGroupIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignedLabel =
    summary && summary.totalAssigned > 0
      ? `Already assigned to ${summary.totalAssigned} student${summary.totalAssigned !== 1 ? 's' : ''}${
          summary.assignedGroups.length
            ? ` · ${summary.assignedGroups.map((g) => g.name).join(', ')}`
            : ''
        }`
      : null;

  const canSubmit =
    Boolean(academicYearId) &&
    !saving &&
    (newStudentCount > 0 ||
      (dueDateChanged && (selected.size > 0 || alreadyAssignedGroupIds.size > 0)));

  let submitLabel = `Assign to ${selectedStudentCount} student${selectedStudentCount !== 1 ? 's' : ''}`;
  if (saving) submitLabel = 'Saving…';
  else if (newStudentCount > 0 && dueDateChanged)
    submitLabel = `Assign ${newStudentCount} more · update due date`;
  else if (newStudentCount > 0)
    submitLabel = `Assign ${newStudentCount} more student${newStudentCount !== 1 ? 's' : ''}`;
  else if (dueDateChanged) submitLabel = 'Update due date';

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title="Assign to groups"
      description={assessment.title}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const groupIds = [...new Set([...selected, ...alreadyAssignedGroupIds])];
              onAssign(
                groupIds,
                dueDate ? new Date(dueDate).toISOString() : null,
                academicYearId
              );
            }}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Academic year" htmlFor="assign-year">
          {yearsLoading ? (
            <Skeleton className="h-10" />
          ) : (
            <select
              id="assign-year"
              className={selectClass}
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setHydratedKey('');
              }}
            >
              {sortedYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Due date" htmlFor="assign-due" hint="Optional">
          <Input
            id="assign-due"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>

        {assignedLabel ? (
          <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {assignedLabel}
          </p>
        ) : null}

        {isLoading || summaryLoading ? (
          <Skeleton className="h-24" />
        ) : groups.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No student groups yet.</p>
        ) : (
          <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {groups.map((g) => {
              const already = alreadyAssignedGroupIds.has(g.id);
              const checked = selected.has(g.id) || already;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={already}
                  onClick={() => toggle(g.id)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                    already && 'cursor-default opacity-90',
                    checked
                      ? 'bg-brand-50 dark:bg-brand-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 dark:border-slate-500'
                    )}
                  >
                    {checked ? (
                      <svg className="h-2 w-2" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm text-slate-900 dark:text-white">{g.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {g.memberCount} student{g.memberCount !== 1 ? 's' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AssessmentsPage({ kind = 'assessment' }: { kind?: ExamKind }) {
  const online = kind === 'online_exam';
  const base = online ? '/online-exams' : '/assessments';
  const noun = online ? 'online exam' : 'assessment';
  const navigate = useNavigate();
  const { data, isLoading } = useAssessmentsQuery({ kind });
  const { data: org } = useTenantOrganization();
  const { publish, unpublish, remove, assign } = useAssessmentMutations();
  const [assignTarget, setAssignTarget] = useState<Assessment | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [busyId, setBusyId] = useState('');

  const assessments = data?.assessments ?? [];
  const canCreateWithAi = resolveOrgFeatures(org).aiAssessmentCreate;

  const handlePublishToggle = async (a: Assessment) => {
    setBusyId(a.id);
    try {
      if (a.status === 'published') {
        if (!window.confirm(`Unpublish "${a.title}"? Students will no longer see it.`)) return;
        await unpublish.mutateAsync(a.id);
        toast.success('Unpublished');
      } else {
        await publish.mutateAsync(a.id);
        toast.success('Published');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update publish status');
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (a: Assessment) => {
    const warning = a.submittedCount
      ? `Delete "${a.title}"? ${a.submittedCount} result(s) will be removed too.`
      : `Delete "${a.title}"?`;
    if (!window.confirm(warning)) return;
    setBusyId(a.id);
    try {
      await remove.mutateAsync(a.id);
      toast.success(online ? 'Online exam deleted' : 'Assessment deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to delete');
    } finally {
      setBusyId('');
    }
  };

  const handleAssign = async (
    groupIds: string[],
    dueDate: string | null,
    academicYearId: string
  ) => {
    if (!assignTarget) return;
    try {
      await assign.mutateAsync({ id: assignTarget.id, groupIds, dueDate, academicYearId });
      toast.success('Assignment saved');
      setAssignTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to assign');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={online ? 'Exams' : 'Assessments'}
        title={online ? 'Online exams' : 'Assessments'}
        description={
          online
            ? 'CBT exams. If a student leaves fullscreen three times, the exam submits automatically.'
            : 'Question papers students attempt online. This is not the locked CBT exam.'
        }
        actions={
          <>
            {canCreateWithAi ? (
              <Button variant="secondary" onClick={() => setAiOpen(true)}>
                Create with AI
              </Button>
            ) : null}
            <Button onClick={() => navigate(`${base}/new`)}>+ New {noun}</Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : assessments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={online ? 'No online exams yet' : 'No assessments yet'}
            description={
              online
                ? 'Create an exam with questions, assign students, then launch the locked CBT.'
                : 'Create an assessment with questions, assign students, then launch.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {canCreateWithAi ? (
                  <Button variant="secondary" onClick={() => setAiOpen(true)}>
                    Create with AI
                  </Button>
                ) : null}
                <Button onClick={() => navigate(`${base}/new`)}>Create {noun}</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assessments.map((a) => {
            const qCount = a.questionCount ?? a.questions?.length ?? 0;
            const marks =
              a.totalMarks ??
              (a.questions || []).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
            const startLabel = formatDateTime(a.startAt);
            const endLabel = formatDateTime(a.endAt);
            const busy = busyId === a.id;

            return (
              <Card key={a.id} className="flex flex-col p-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone={a.status === 'published' ? 'success' : 'neutral'}>
                    {a.status === 'published' ? 'Published' : a.status === 'closed' ? 'Closed' : 'Draft'}
                  </Badge>
                  {(a.submittedCount || 0) > 0 ? (
                    <Badge tone={a.resultsReleased ? 'info' : 'warning'}>
                      {a.resultsReleased ? 'Results out' : 'Results held'}
                    </Badge>
                  ) : (
                    <Badge tone="warning">No submissions</Badge>
                  )}
                  {startLabel ? <Badge tone="warning">{startLabel}</Badge> : null}
                  {endLabel ? <Badge tone="neutral">Ends {endLabel}</Badge> : null}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{a.title}</h3>
                {a.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.description}</p>
                ) : null}

                <p className="mt-3 text-xs text-slate-500">
                  {qCount} question{qCount !== 1 ? 's' : ''} · {marks} mark{marks !== 1 ? 's' : ''} ·{' '}
                  {a.durationMinutes ?? 60} min · {a.assignmentCount || 0} assigned ·{' '}
                  {a.submittedCount || 0} attempt{(a.submittedCount || 0) !== 1 ? 's' : ''}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`${base}/${a.id}/results`)}
                  >
                    Results
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => handlePublishToggle(a)}
                  >
                    {a.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  {a.status === 'draft' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`${base}/${a.id}/edit`)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setAssignTarget(a)}>
                      Assign
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleDelete(a)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {assignTarget ? (
        <AssignModal
          open
          assessment={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssign}
          saving={assign.isPending}
        />
      ) : null}

      {canCreateWithAi ? (
        <CreateWithAiModal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onGenerated={(draft: AiAssessmentDraft) =>
            navigate(`${base}/new`, { state: { aiDraft: draft } })
          }
        />
      ) : null}
    </div>
  );
}
