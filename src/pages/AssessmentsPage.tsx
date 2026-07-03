import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useAssessmentsQuery,
  useAssessmentResultsQuery,
  useAssessmentMutations,
  type Assessment,
  type AssessmentQuestion,
  type QuestionType,
} from '@/hooks/api/useAssessments';
import { useStudentGroupsQuery } from '@/hooks/api/useStudentGroups';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_select: 'Single select',
  multi_select: 'Multi select',
  short_answer: 'Short answer',
};

function emptyQuestion(type: QuestionType, order: number): AssessmentQuestion {
  if (type === 'short_answer') {
    return {
      type,
      prompt: '',
      points: 1,
      order,
      options: [],
      acceptedAnswers: [''],
      caseSensitive: false,
    };
  }
  return {
    type,
    prompt: '',
    points: 1,
    order,
    options: [
      { text: '', isCorrect: type === 'single_select' },
      { text: '', isCorrect: false },
    ],
  };
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: AssessmentQuestion;
  index: number;
  onChange: (q: AssessmentQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Q{index + 1}</span>
          <Badge tone="info">{QUESTION_TYPE_LABELS[question.type]}</Badge>
        </div>
        <Button type="button" variant="danger" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <textarea
        placeholder="Question prompt *"
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm min-h-[72px]"
        value={question.prompt}
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
      />

      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500">Points</label>
        <input
          type="number"
          min={0}
          max={100}
          className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm"
          value={question.points}
          onChange={(e) => onChange({ ...question, points: Number(e.target.value) || 0 })}
        />
      </div>

      {(question.type === 'single_select' || question.type === 'multi_select') && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Options (mark correct answer{question.type === 'multi_select' ? 's' : ''})</p>
          {question.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type={question.type === 'single_select' ? 'radio' : 'checkbox'}
                name={`q-${index}-correct`}
                checked={!!opt.isCorrect}
                onChange={() => {
                  const options = question.options.map((o, i) => {
                    if (question.type === 'single_select') {
                      return { ...o, isCorrect: i === oi };
                    }
                    return i === oi ? { ...o, isCorrect: !o.isCorrect } : o;
                  });
                  onChange({ ...question, options });
                }}
              />
              <input
                placeholder={`Option ${oi + 1}`}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
                value={opt.text}
                onChange={(e) => {
                  const options = question.options.map((o, i) =>
                    i === oi ? { ...o, text: e.target.value } : o
                  );
                  onChange({ ...question, options });
                }}
              />
              {question.options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...question, options: question.options.filter((_, i) => i !== oi) })
                  }
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({
                ...question,
                options: [...question.options, { text: '', isCorrect: false }],
              })
            }
          >
            Add option
          </Button>
        </div>
      )}

      {question.type === 'short_answer' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Accepted answers (1–2 words each)</p>
          {(question.acceptedAnswers || ['']).map((ans, ai) => (
            <div key={ai} className="flex gap-2">
              <input
                placeholder="e.g. Paris"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
                value={ans}
                onChange={(e) => {
                  const acceptedAnswers = [...(question.acceptedAnswers || [''])];
                  acceptedAnswers[ai] = e.target.value;
                  onChange({ ...question, acceptedAnswers });
                }}
              />
              {(question.acceptedAnswers?.length || 0) > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...question,
                      acceptedAnswers: question.acceptedAnswers?.filter((_, i) => i !== ai),
                    })
                  }
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({
                ...question,
                acceptedAnswers: [...(question.acceptedAnswers || []), ''],
              })
            }
          >
            Add alternate answer
          </Button>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={question.caseSensitive ?? false}
              onChange={(e) => onChange({ ...question, caseSensitive: e.target.checked })}
            />
            Case sensitive
          </label>
        </div>
      )}
    </Card>
  );
}

function AssessmentBuilderModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Assessment | null;
  onClose: () => void;
  onSave: (data: { title: string; description: string; questions: AssessmentQuestion[] }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(
    initial?.questions?.length
      ? initial.questions.map((q, i) => ({ ...q, order: i }))
      : [emptyQuestion('single_select', 0)]
  );

  const canSave = useMemo(() => {
    if (!title.trim() || !questions.length) return false;
    return questions.every((q) => {
      if (!q.prompt.trim()) return false;
      if (q.type === 'short_answer') {
        return (q.acceptedAnswers || []).some((a) => a.trim());
      }
      if (q.options.length < 2) return false;
      const correct = q.options.filter((o) => o.isCorrect && o.text.trim());
      if (q.type === 'single_select') return correct.length === 1;
      return correct.length >= 1 && q.options.every((o) => o.text.trim());
    });
  }, [title, questions]);

  const addQuestion = (type: QuestionType) => {
    setQuestions((qs) => [...qs, emptyQuestion(type, qs.length)]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      questions: questions.map((q, i) => ({
        ...q,
        order: i,
        options: q.options.map(({ text, isCorrect }) => ({ text: text.trim(), isCorrect: !!isCorrect })),
        acceptedAnswers: (q.acceptedAnswers || []).map((a) => a.trim()).filter(Boolean),
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {initial ? 'Edit assessment' : 'Create assessment'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Add questions — single select, multi select, or short answer.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            placeholder="Assessment title *"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={i}
                question={q}
                index={i}
                onChange={(updated) =>
                  setQuestions((qs) => qs.map((item, idx) => (idx === i ? updated : item)))
                }
                onRemove={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion('single_select')}>
              + Single select
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion('multi_select')}>
              + Multi select
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion('short_answer')}>
              + Short answer
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create draft'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AssignModal({
  assessment,
  onClose,
  onAssign,
  saving,
}: {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Assign to groups</h3>
            <p className="text-xs text-slate-500 mt-1">{assessment.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 text-sm">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-500">Due date (optional)</label>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          {isLoading ? (
            <Skeleton className="h-24" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-500">
              No student groups yet. Create groups under Group students first.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {groups.map((g) => (
                <label key={g.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(g.id)}
                    onChange={() => toggle(g.id)}
                  />
                  <span>
                    <span className="font-medium">{g.name}</span>
                    <span className="block text-xs text-slate-400">
                      {g.memberCount} student{g.memberCount !== 1 ? 's' : ''}
                      {g.members?.length
                        ? ` · ${g.members.map((m) => m.label).join(', ')}`
                        : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
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
        </div>
      </Card>
    </div>
  );
}

function ResultsModal({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const { data, isLoading } = useAssessmentResultsQuery(assessmentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Results</h3>
            <p className="text-xs text-slate-500 mt-1">{data?.assessment.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 text-sm">
            Close
          </button>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 mt-4" />
        ) : !data?.results.length ? (
          <p className="text-sm text-slate-500 mt-4">No assignments yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {data.results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{r.studentLabel}</p>
                  <p className="text-xs text-slate-500">{r.studentEmail}</p>
                </div>
                <div className="text-right">
                  <Badge tone={r.status === 'submitted' ? 'success' : 'warning'}>
                    {r.status === 'submitted' ? `${r.score}/${r.maxScore}` : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function statusTone(status: Assessment['status']) {
  if (status === 'published') return 'success' as const;
  if (status === 'closed') return 'neutral' as const;
  return 'warning' as const;
}

export function AssessmentsPage() {
  const { data, isLoading } = useAssessmentsQuery();
  const { create, update, publish, assign } = useAssessmentMutations();
  const [builderTarget, setBuilderTarget] = useState<Assessment | null | 'new'>('new');
  const [assignTarget, setAssignTarget] = useState<Assessment | null>(null);
  const [resultsId, setResultsId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const assessments = data?.assessments ?? [];

  const handleSave = async (form: { title: string; description: string; questions: AssessmentQuestion[] }) => {
    try {
      if (builderTarget && builderTarget !== 'new') {
        await update.mutateAsync({ id: builderTarget.id, ...form });
        toast.success('Assessment updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Assessment created');
      }
      setShowBuilder(false);
      setBuilderTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save assessment');
    }
  };

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
          <Button
            onClick={() => {
              setBuilderTarget('new');
              setShowBuilder(true);
            }}
          >
            New assessment
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : assessments.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No assessments yet. Create your first assessment to get started.
        </Card>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-slate-900 dark:text-white truncate">{a.title}</h3>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {a.questions.length} question{a.questions.length !== 1 ? 's' : ''}
                  {a.description ? ` · ${a.description}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {a.status === 'draft' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setBuilderTarget(a);
                        setShowBuilder(true);
                      }}
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

      {showBuilder && (
        <AssessmentBuilderModal
          initial={builderTarget && builderTarget !== 'new' ? builderTarget : null}
          onClose={() => {
            setShowBuilder(false);
            setBuilderTarget(null);
          }}
          onSave={handleSave}
          saving={create.isPending || update.isPending}
        />
      )}

      {assignTarget && (
        <AssignModal
          assessment={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssign}
          saving={assign.isPending}
        />
      )}

      {resultsId && <ResultsModal assessmentId={resultsId} onClose={() => setResultsId(null)} />}
    </div>
  );
}
