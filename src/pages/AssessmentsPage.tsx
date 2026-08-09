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
  useAssessmentResultsQuery,
  useAssessmentAssignmentSummaryQuery,
  useAssessmentMutations,
  type Assessment,
} from '@/hooks/api/useAssessments';
import { useStudentGroupsQuery } from '@/hooks/api/useStudentGroups';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import { useTenantOrganization } from '@/hooks/api/useTenant';
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

  const {
    data: summary,
    isLoading: summaryLoading,
  } = useAssessmentAssignmentSummaryQuery(
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

  const loadingSummary = summaryLoading;
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
      onClose={onClose}
      title="Assign to groups"
      description={assessment.title}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
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
      <div className="space-y-4">
        <FormField label="Academic year" htmlFor="assign-year" hint="Students see this under that year">
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

        <FormField
          label="Due date"
          htmlFor="assign-due"
          hint="Optional · applies to all selected groups"
        >
          <Input
            id="assign-due"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>

        {assignedLabel ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-sm text-slate-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-slate-200">
            {assignedLabel}
          </p>
        ) : null}

        {isLoading || loadingSummary ? (
          <Skeleton className="h-24" />
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
            No student groups yet. Create groups under Group students first.
          </p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {groups.map((g) => {
              const already = alreadyAssignedGroupIds.has(g.id);
              const checked = selected.has(g.id) || already;
              const assignedInGroup = (g.studentIds || []).filter((sid) =>
                (summary?.assignedStudentIds || []).includes(sid)
              ).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={already}
                  onClick={() => toggle(g.id)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    already && 'cursor-default opacity-95',
                    checked
                      ? 'border-brand-400 bg-brand-50/70 dark:border-brand-500/50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                      checked
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 dark:border-slate-500',
                      already && 'opacity-80'
                    )}
                    aria-hidden
                  >
                    {checked && (
                      <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">
                        {g.name}
                      </span>
                      {already ? (
                        <Badge tone="success">Assigned</Badge>
                      ) : assignedInGroup > 0 ? (
                        <Badge tone="neutral">
                          {assignedInGroup}/{g.memberCount} assigned
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {g.memberCount} student{g.memberCount !== 1 ? 's' : ''}
                      {g.members?.length ? ` · ${g.members.map((m) => m.label).join(', ')}` : ''}
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

function ResultsModal({
  open,
  assessmentId,
  onClose,
}: {
  open: boolean;
  assessmentId: string;
  onClose: () => void;
}) {
  const { data: years = [] } = useAcademicYearsQuery();
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => b.label.localeCompare(a.label)),
    [years]
  );
  const [yearId, setYearId] = useState('');

  useEffect(() => {
    if (yearId || !sortedYears.length) return;
    const current = sortedYears.find((y) => y.isCurrent) || sortedYears[0];
    setYearId(current.id);
  }, [sortedYears, yearId]);

  const { data, isLoading } = useAssessmentResultsQuery(assessmentId, yearId || undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Results"
      description={data?.assessment.title}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {sortedYears.length ? (
          <label className="block text-xs text-slate-500 space-y-1">
            <span>Academic year</span>
            <select
              className={selectClass}
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {sortedYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
              <option value="all">All years</option>
            </select>
          </label>
        ) : null}

        {isLoading || (sortedYears.length > 0 && !yearId) ? (
          <Skeleton className="h-32" />
        ) : !data?.results.length ? (
          <p className="text-sm text-slate-500">No assignments for this year yet.</p>
        ) : (
          <div className="space-y-2">
            {data.results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2.5 text-sm dark:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{r.studentLabel}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {r.studentEmail}
                    {yearId === 'all' && r.academicYearLabel ? ` · ${r.academicYearLabel}` : ''}
                  </p>
                </div>
                <Badge tone={r.status === 'submitted' ? 'success' : 'warning'}>
                  {r.status === 'submitted' ? `${r.score}/${r.maxScore}` : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function statusTone(status: Assessment['status']) {
  if (status === 'published') return 'success' as const;
  if (status === 'closed') return 'neutral' as const;
  return 'warning' as const;
}

export function AssessmentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAssessmentsQuery();
  const { data: org } = useTenantOrganization();
  const { publish, assign } = useAssessmentMutations();
  const [assignTarget, setAssignTarget] = useState<Assessment | null>(null);
  const [resultsId, setResultsId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const assessments = data?.assessments ?? [];
  const canCreateWithAi = org?.features?.aiAssessmentCreate === true;

  const handlePublish = async (id: string) => {
    try {
      await publish.mutateAsync(id);
      toast.success('Assessment published');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to publish');
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

  const handleAiGenerated = (draft: AiAssessmentDraft) => {
    navigate('/assessments/new', { state: { aiDraft: draft } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment dashboard"
        description="Create questions, publish assessments, and assign them to student groups for an academic year."
        actions={
          <>
            {canCreateWithAi ? (
              <Button variant="secondary" onClick={() => setAiOpen(true)}>
                Create with AI
              </Button>
            ) : null}
            <Button onClick={() => navigate('/assessments/new')}>New assessment</Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : assessments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No assessments yet"
            description="Create your first assessment to start assigning quizzes to students."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {canCreateWithAi ? (
                  <Button variant="secondary" onClick={() => setAiOpen(true)}>
                    Create with AI
                  </Button>
                ) : null}
                <Button onClick={() => navigate('/assessments/new')}>New assessment</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{a.title}</h3>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {a.questions.length} question{a.questions.length !== 1 ? 's' : ''}
                  {a.description ? ` · ${a.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {a.status === 'draft' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/assessments/${a.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => handlePublish(a.id)}>
                      Publish
                    </Button>
                  </>
                )}
                {a.status === 'published' && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setAssignTarget(a)}>
                      Assign
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setResultsId(a.id)}>
                      Results
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {assignTarget && (
        <AssignModal
          open
          assessment={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssign}
          saving={assign.isPending}
        />
      )}

      {resultsId && (
        <ResultsModal open assessmentId={resultsId} onClose={() => setResultsId(null)} />
      )}

      {canCreateWithAi ? (
        <CreateWithAiModal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onGenerated={handleAiGenerated}
        />
      ) : null}
    </div>
  );
}
