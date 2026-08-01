import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Badge, Button, Card, Input, Skeleton } from '@/components/ui';
import {
  useAssignmentQuery,
  useAssessmentMutations,
  type AssessmentQuestion,
} from '@/hooks/api/useAssessments';

type AnswerState = {
  selectedOptionIds: string[];
  textAnswer: string;
};

function OptionRow({
  selected,
  disabled,
  onSelect,
  children,
  correctHint,
}: {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  correctHint?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50/80 dark:border-brand-500 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:hover:border-slate-500',
        disabled && 'cursor-default opacity-90 hover:border-slate-200 dark:hover:border-slate-600'
      )}
    >
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 dark:border-slate-500'
        )}
        aria-hidden
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="flex-1 text-slate-800 dark:text-slate-100">{children}</span>
      {correctHint && (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">(correct)</span>
      )}
    </button>
  );
}

function CheckboxRow({
  selected,
  disabled,
  onToggle,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50/80 dark:border-brand-500 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:hover:border-slate-500',
        disabled && 'cursor-default opacity-90 hover:border-slate-200 dark:hover:border-slate-600'
      )}
    >
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
          selected
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 dark:border-slate-500'
        )}
        aria-hidden
      >
        {selected && (
          <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden>
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
      <span className="flex-1 text-slate-800 dark:text-slate-100">{children}</span>
    </button>
  );
}

function QuestionBlock({
  question,
  index,
  answer,
  onChange,
  readOnly,
  showResult,
}: {
  question: AssessmentQuestion;
  index: number;
  answer: AnswerState;
  onChange: (a: AnswerState) => void;
  readOnly: boolean;
  showResult?: { isCorrect?: boolean; pointsEarned?: number };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div
        className={clsx(
          'absolute inset-y-0 left-0 w-1',
          showResult
            ? showResult.isCorrect
              ? 'bg-emerald-500'
              : 'bg-rose-500'
            : 'bg-brand-500'
        )}
        aria-hidden
      />
      <div className="space-y-3 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 px-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
              {index + 1}
            </span>
            <p className="pt-0.5 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
              {question.prompt}
            </p>
          </div>
          <Badge tone="neutral" className="shrink-0">
            {question.points} pt{question.points !== 1 ? 's' : ''}
          </Badge>
        </div>

        {showResult && (
          <Badge tone={showResult.isCorrect ? 'success' : 'danger'}>
            {showResult.isCorrect ? `Correct (+${showResult.pointsEarned})` : 'Incorrect'}
          </Badge>
        )}

        {question.type === 'single_select' && (
          <div className="space-y-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
            {question.options.map((opt) => (
              <OptionRow
                key={opt.id}
                selected={answer.selectedOptionIds[0] === opt.id}
                disabled={readOnly}
                onSelect={() => onChange({ ...answer, selectedOptionIds: opt.id ? [opt.id] : [] })}
                correctHint={Boolean(readOnly && showResult && opt.isCorrect)}
              >
                {opt.text}
              </OptionRow>
            ))}
          </div>
        )}

        {question.type === 'multi_select' && (
          <div className="space-y-2" role="group" aria-label={`Question ${index + 1}`}>
            {question.options.map((opt) => (
              <CheckboxRow
                key={opt.id}
                selected={answer.selectedOptionIds.includes(opt.id || '')}
                disabled={readOnly}
                onToggle={() => {
                  const id = opt.id || '';
                  const next = answer.selectedOptionIds.includes(id)
                    ? answer.selectedOptionIds.filter((x) => x !== id)
                    : [...answer.selectedOptionIds, id];
                  onChange({ ...answer, selectedOptionIds: next });
                }}
              >
                {opt.text}
              </CheckboxRow>
            ))}
          </div>
        )}

        {question.type === 'short_answer' && (
          <div className="max-w-sm space-y-1.5">
            <Input
              type="text"
              disabled={readOnly}
              placeholder="1–2 words"
              maxLength={100}
              value={answer.textAnswer}
              onChange={(e) => onChange({ ...answer, textAnswer: e.target.value })}
            />
            {readOnly && showResult && question.acceptedAnswers?.length ? (
              <p className="text-xs text-slate-500">Accepted: {question.acceptedAnswers.join(', ')}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function TakeAssessmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAssignmentQuery(assignmentId);
  const { submit } = useAssessmentMutations();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  const isSubmitted = data?.assignment.status === 'submitted';
  const readOnly = isSubmitted;

  const answerMap = useMemo(() => {
    if (!isSubmitted || !data?.assignment.answers) return new Map();
    return new Map(data.assignment.answers.map((a) => [a.questionId, a]));
  }, [isSubmitted, data?.assignment.answers]);

  const initAnswer = (q: AssessmentQuestion): AnswerState => {
    const existing = answers[q.id || ''];
    if (existing) return existing;
    if (isSubmitted) {
      const saved = answerMap.get(q.id || '');
      return {
        selectedOptionIds: (saved?.selectedOptionIds || []).map(String),
        textAnswer: saved?.textAnswer || '',
      };
    }
    return { selectedOptionIds: [], textAnswer: '' };
  };

  const answeredCount = useMemo(() => {
    if (!data?.assessment.questions.length || isSubmitted) return 0;
    return data.assessment.questions.filter((q) => {
      const a = answers[q.id || ''];
      if (!a) return false;
      if (q.type === 'short_answer') return a.textAnswer.trim().length > 0;
      return a.selectedOptionIds.length > 0;
    }).length;
  }, [data, answers, isSubmitted]);

  const allAnswered = useMemo(() => {
    if (!data?.assessment.questions.length || isSubmitted) return false;
    return answeredCount === data.assessment.questions.length;
  }, [data, answeredCount, isSubmitted]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignmentId || !data || !allAnswered || readOnly) return;

    for (const q of data.assessment.questions) {
      if (q.type === 'short_answer') {
        const text = (answers[q.id || '']?.textAnswer || '').trim();
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length > 2) {
          toast.error('Short answers must be 1–2 words');
          return;
        }
      }
    }

    try {
      await submit.mutateAsync({
        assignmentId,
        answers: data.assessment.questions.map((q) => {
          const a = answers[q.id || ''] ?? { selectedOptionIds: [], textAnswer: '' };
          return {
            questionId: q.id!,
            selectedOptionIds: a.selectedOptionIds,
            textAnswer: a.textAnswer,
          };
        }),
      });
      toast.success('Assessment submitted');
      navigate('/my-assessments');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to submit');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-slate-500">
        Assessment not found.{' '}
        <Link to="/my-assessments" className="text-brand-600 hover:underline dark:text-brand-400">
          Back to list
        </Link>
      </Card>
    );
  }

  const { assessment, assignment } = data;
  const questionCount = assessment.questions.length;
  const progressPct = questionCount ? Math.round((answeredCount / questionCount) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate('/my-assessments')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          My assessments
        </button>

        <Card className="relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-cyan-400"
            aria-hidden
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={isSubmitted ? 'success' : 'warning'}>
                  {isSubmitted ? 'Submitted' : 'In progress'}
                </Badge>
                <span className="text-xs text-slate-500">
                  {questionCount} question{questionCount !== 1 ? 's' : ''}
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {assessment.title}
              </h1>
              {assessment.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {assessment.description}
                </p>
              ) : null}
              {assignment.dueDate ? (
                <p className="mt-2 text-xs text-slate-500">
                  Due {new Date(assignment.dueDate).toLocaleString()}
                </p>
              ) : null}
            </div>

            {isSubmitted ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center dark:bg-emerald-500/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Your score
                </p>
                <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {assignment.score}
                  <span className="text-base font-semibold text-emerald-600/80 dark:text-emerald-400/80">
                    /{assignment.maxScore}
                  </span>
                </p>
              </div>
            ) : null}
          </div>

          {!isSubmitted && questionCount > 0 ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Answered {answeredCount} of {questionCount}
                </span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {assessment.questions.map((q, i) => {
          const qid = q.id || '';
          const saved = answerMap.get(qid);
          return (
            <QuestionBlock
              key={qid}
              question={q}
              index={i}
              answer={initAnswer(q)}
              readOnly={readOnly}
              showResult={
                isSubmitted
                  ? { isCorrect: saved?.isCorrect, pointsEarned: saved?.pointsEarned }
                  : undefined
              }
              onChange={(a) => setAnswers((prev) => ({ ...prev, [qid]: a }))}
            />
          );
        })}

        {!readOnly && (
          <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 border-brand-200/60 bg-white/95 shadow-glow backdrop-blur dark:border-brand-800/40 dark:bg-slate-900/95">
            <span className="mr-auto text-xs text-slate-500">
              {allAnswered
                ? 'Ready to submit'
                : `${questionCount - answeredCount} question${questionCount - answeredCount !== 1 ? 's' : ''} left`}
            </span>
            <Button type="button" variant="secondary" onClick={() => navigate('/my-assessments')}>
              Cancel
            </Button>
            <Button type="submit" disabled={!allAnswered || submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit assessment'}
            </Button>
          </Card>
        )}
      </form>
    </div>
  );
}
