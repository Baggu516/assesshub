import { useMemo, useState } from 'react';
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
  useAssessmentMutations,
  type Assessment,
} from '@/hooks/api/useAssessments';
import { useStudentGroupsQuery } from '@/hooks/api/useStudentGroups';

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
  onAssign: (groupIds: string[], dueDate: string | null) => void;
  saving: boolean;
}) {
  const { data: groups = [], isLoading } = useStudentGroupsQuery();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');

  const selectedStudentCount = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      if (selected.has(g.id)) {
        for (const sid of g.studentIds) ids.add(sid);
      }
    }
    return ids.size;
  }, [groups, selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            disabled={selected.size === 0 || saving}
            onClick={() => onAssign([...selected], dueDate ? new Date(dueDate).toISOString() : null)}
          >
            {saving
              ? 'Assigning…'
              : `Assign to ${selectedStudentCount} student${selectedStudentCount !== 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Due date" htmlFor="assign-due" hint="Optional">
          <Input
            id="assign-due"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>

        {isLoading ? (
          <Skeleton className="h-24" />
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
            No student groups yet. Create groups under Group students first.
          </p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {groups.map((g) => {
              const checked = selected.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
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
                        : 'border-slate-300 dark:border-slate-500'
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
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">
                      {g.name}
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
  const { data, isLoading } = useAssessmentResultsQuery(assessmentId);

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
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !data?.results.length ? (
        <p className="text-sm text-slate-500">No assignments yet.</p>
      ) : (
        <div className="space-y-2">
          {data.results.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2.5 text-sm dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{r.studentLabel}</p>
                <p className="text-xs text-slate-500 truncate">{r.studentEmail}</p>
              </div>
              <Badge tone={r.status === 'submitted' ? 'success' : 'warning'}>
                {r.status === 'submitted' ? `${r.score}/${r.maxScore}` : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      )}
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
  const { publish, assign } = useAssessmentMutations();
  const [assignTarget, setAssignTarget] = useState<Assessment | null>(null);
  const [resultsId, setResultsId] = useState<string | null>(null);

  const assessments = data?.assessments ?? [];

  const handlePublish = async (id: string) => {
    try {
      await publish.mutateAsync(id);
      toast.success('Assessment published');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to publish');
    }
  };

  const handleAssign = async (groupIds: string[], dueDate: string | null) => {
    if (!assignTarget) return;
    try {
      await assign.mutateAsync({ id: assignTarget.id, groupIds, dueDate });
      toast.success('Assigned to group students');
      setAssignTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to assign');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment dashboard"
        description="Create questions, publish assessments, and assign them to student groups."
        actions={
          <Button onClick={() => navigate('/assessments/new')}>New assessment</Button>
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
            action={<Button onClick={() => navigate('/assessments/new')}>New assessment</Button>}
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
    </div>
  );
}
