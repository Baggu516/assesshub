import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
  Toggle,
} from '@/components/ui';
import {
  useAssessmentQuery,
  useAssessmentMutations,
  type AssessmentQuestion,
  type QuestionType,
} from '@/hooks/api/useAssessments';
import type { AiAssessmentDraft } from '@/components/assessments/CreateWithAiModal';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_select: 'Single select',
  multi_select: 'Multi select',
  short_answer: 'Short answer',
};

const QUESTION_TYPE_TONE: Record<QuestionType, 'brand' | 'info' | 'warning'> = {
  single_select: 'brand',
  multi_select: 'info',
  short_answer: 'warning',
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

function CorrectMark({
  kind,
  checked,
  onChange,
}: {
  kind: 'radio' | 'checkbox';
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={clsx(
        'flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors',
        kind === 'radio' ? 'rounded-full' : 'rounded-md',
        checked
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white hover:border-brand-400 dark:border-slate-500 dark:bg-slate-950'
      )}
      aria-pressed={checked}
      title={checked ? 'Marked correct' : 'Mark as correct'}
    >
      {checked && kind === 'radio' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      {checked && kind === 'checkbox' && (
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  question: AssessmentQuestion;
  index: number;
  onChange: (q: AssessmentQuestion) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
      <div
        className={clsx(
          'absolute inset-y-0 left-0 w-1',
          question.type === 'single_select' && 'bg-brand-500',
          question.type === 'multi_select' && 'bg-sky-500',
          question.type === 'short_answer' && 'bg-amber-500'
        )}
        aria-hidden
      />

      <div className="space-y-4 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
              Q{index + 1}
            </span>
            <Badge tone={QUESTION_TYPE_TONE[question.type]}>
              {QUESTION_TYPE_LABELS[question.type]}
            </Badge>
          </div>
          {canRemove && (
            <Button type="button" variant="danger" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>

        <FormField label="Question" htmlFor={`q-prompt-${index}`} required>
          <Textarea
            id={`q-prompt-${index}`}
            placeholder="What do you want to ask?"
            className="min-h-[76px] rounded-xl"
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          />
        </FormField>

        <FormField label="Points" htmlFor={`q-points-${index}`} className="max-w-[8rem]">
          <Input
            id={`q-points-${index}`}
            type="number"
            min={0}
            max={100}
            inputSize="sm"
            value={question.points}
            onChange={(e) => onChange({ ...question, points: Number(e.target.value) || 0 })}
          />
        </FormField>

        {(question.type === 'single_select' || question.type === 'multi_select') && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Options — mark the correct answer{question.type === 'multi_select' ? 's' : ''}
            </p>
            <div className="space-y-2">
              {question.options.map((opt, oi) => (
                <div
                  key={oi}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors',
                    opt.isCorrect
                      ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10'
                      : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950'
                  )}
                >
                  <CorrectMark
                    kind={question.type === 'single_select' ? 'radio' : 'checkbox'}
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
                  <Input
                    placeholder={`Option ${oi + 1}`}
                    inputSize="sm"
                    className="border-0 bg-transparent shadow-none focus:ring-0"
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
                      className="shrink-0 text-slate-400"
                      onClick={() =>
                        onChange({
                          ...question,
                          options: question.options.filter((_, i) => i !== oi),
                        })
                      }
                      aria-label="Remove option"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Accepted answers (1–2 words each)
            </p>
            <div className="space-y-2">
              {(question.acceptedAnswers || ['']).map((ans, ai) => (
                <div key={ai} className="flex gap-2">
                  <Input
                    placeholder="e.g. Paris"
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
                      aria-label="Remove answer"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Toggle
                  checked={question.caseSensitive ?? false}
                  onChange={(checked) => onChange({ ...question, caseSensitive: checked })}
                />
                Case sensitive
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AssessmentBuilderPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const isEdit = Boolean(assessmentId);
  const navigate = useNavigate();
  const location = useLocation();
  const aiDraft = (location.state as { aiDraft?: AiAssessmentDraft } | null)?.aiDraft;
  const { data: existing, isLoading, isError } = useAssessmentQuery(assessmentId);
  const { create, update } = useAssessmentMutations();

  const [title, setTitle] = useState(() => aiDraft?.title || '');
  const [description, setDescription] = useState(() => aiDraft?.description || '');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(() =>
    aiDraft?.questions?.length
      ? aiDraft.questions.map((q, i) => ({ ...q, order: i }))
      : [emptyQuestion('single_select', 0)]
  );
  const [hydrated, setHydrated] = useState(!isEdit);
  const [fromAi] = useState(() => Boolean(aiDraft?.questions?.length));

  useEffect(() => {
    if (!aiDraft || isEdit) return;
    // Clear one-shot router state so a refresh doesn't re-apply the draft.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when AI draft is present
  }, []);

  useEffect(() => {
    if (!isEdit || !existing) return;
    if (existing.status !== 'draft') {
      toast.error('Only draft assessments can be edited');
      navigate('/assessments', { replace: true });
      return;
    }
    setTitle(existing.title);
    setDescription(existing.description || '');
    setQuestions(
      existing.questions?.length
        ? existing.questions.map((q, i) => ({ ...q, order: i }))
        : [emptyQuestion('single_select', 0)]
    );
    setHydrated(true);
  }, [isEdit, existing, navigate]);

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions]
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

  const saving = create.isPending || update.isPending;

  const addQuestion = (type: QuestionType) => {
    setQuestions((qs) => [...qs, emptyQuestion(type, qs.length)]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      questions: questions.map((q, i) => ({
        ...q,
        order: i,
        options: q.options.map(({ text, isCorrect }) => ({
          text: text.trim(),
          isCorrect: !!isCorrect,
        })),
        acceptedAnswers: (q.acceptedAnswers || []).map((a) => a.trim()).filter(Boolean),
      })),
    };

    try {
      if (isEdit && assessmentId) {
        await update.mutateAsync({ id: assessmentId, ...payload });
        toast.success('Assessment updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Assessment created');
      }
      navigate('/assessments');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save assessment');
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (isEdit && (isError || (!isLoading && !existing))) {
    return (
      <Card className="max-w-lg p-8 text-center text-sm text-slate-500">
        Assessment not found.{' '}
        <button
          type="button"
          className="text-brand-600 hover:underline dark:text-brand-400"
          onClick={() => navigate('/assessments')}
        >
          Back to list
        </button>
      </Card>
    );
  }

  if (!hydrated) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/assessments')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Assessments
        </button>
        <PageHeader
          title={isEdit ? 'Edit assessment' : fromAi ? 'Review AI draft' : 'Create assessment'}
          description={
            fromAi
              ? 'Review and edit the generated questions, then save as a draft.'
              : 'Build your quiz with single-select, multi-select, or short-answer questions.'
          }
        />      </div>

      <form id="assessment-builder-form" onSubmit={handleSubmit} className="space-y-6">
        <Card className="space-y-4">
          <FormField label="Assessment title" htmlFor="assessment-title" required>
            <Input
              id="assessment-title"
              placeholder="e.g. Midterm — React basics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="assessment-description"
            hint="Optional — shown to students."
          >
            <Textarea
              id="assessment-description"
              placeholder="Brief context or instructions…"
              className="min-h-[64px] rounded-xl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </Card>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Questions</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Add at least one question. Mark correct answers before saving.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {questions.length} · {totalPoints} pt{totalPoints !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionEditor
                key={i}
                question={q}
                index={i}
                canRemove={questions.length > 1}
                onChange={(updated) =>
                  setQuestions((qs) => qs.map((item, idx) => (idx === i ? updated : item)))
                }
                onRemove={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 dark:border-slate-600 dark:bg-slate-900/30">
          <p className="mb-2.5 text-xs font-medium text-slate-500">Add a question</p>
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
        </div>

        <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 border-brand-200/60 bg-white/95 shadow-glow backdrop-blur dark:border-brand-800/40 dark:bg-slate-900/95">
          <span className="mr-auto text-xs text-slate-500">
            {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} pt
            {totalPoints !== 1 ? 's' : ''}
          </span>
          <Button type="button" variant="secondary" onClick={() => navigate('/assessments')}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave || saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create draft'}
          </Button>
        </Card>
      </form>
    </div>
  );
}
