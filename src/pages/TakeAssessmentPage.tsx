import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useAssignmentQuery,
  useAssessmentMutations,
  type AssessmentQuestion,
} from '@/hooks/api/useAssessments';

type AnswerState = {
  selectedOptionIds: string[];
  textAnswer: string;
};

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
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {index + 1}. {question.prompt}
        </p>
        <Badge tone="neutral">{question.points} pt{question.points !== 1 ? 's' : ''}</Badge>
      </div>

      {showResult && (
        <Badge tone={showResult.isCorrect ? 'success' : 'danger'}>
          {showResult.isCorrect ? `Correct (+${showResult.pointsEarned})` : 'Incorrect'}
        </Badge>
      )}

      {question.type === 'single_select' && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`q-${question.id}`}
                disabled={readOnly}
                checked={answer.selectedOptionIds[0] === opt.id}
                onChange={() => onChange({ ...answer, selectedOptionIds: opt.id ? [opt.id] : [] })}
              />
              <span>{opt.text}</span>
              {readOnly && opt.isCorrect !== undefined && showResult && (
                <span className="text-xs text-emerald-600">{opt.isCorrect ? '(correct)' : ''}</span>
              )}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multi_select' && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={answer.selectedOptionIds.includes(opt.id || '')}
                onChange={() => {
                  const id = opt.id || '';
                  const next = answer.selectedOptionIds.includes(id)
                    ? answer.selectedOptionIds.filter((x) => x !== id)
                    : [...answer.selectedOptionIds, id];
                  onChange({ ...answer, selectedOptionIds: next });
                }}
              />
              <span>{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'short_answer' && (
        <div>
          <input
            type="text"
            disabled={readOnly}
            placeholder="1–2 words"
            maxLength={100}
            className="w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={answer.textAnswer}
            onChange={(e) => onChange({ ...answer, textAnswer: e.target.value })}
          />
          {readOnly && showResult && question.acceptedAnswers?.length ? (
            <p className="text-xs text-slate-500 mt-1">
              Accepted: {question.acceptedAnswers.join(', ')}
            </p>
          ) : null}
        </div>
      )}
    </Card>
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

  const allAnswered = useMemo(() => {
    if (!data?.assessment.questions.length || isSubmitted) return false;
    return data.assessment.questions.every((q) => {
      const qid = q.id || '';
      const a = answers[qid];
      if (!a) return false;
      if (q.type === 'short_answer') return a.textAnswer.trim().length > 0;
      return a.selectedOptionIds.length > 0;
    });
  }, [data, answers, isSubmitted]);

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
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        Assessment not found.{' '}
        <Link to="/my-assessments" className="text-indigo-600 hover:underline">
          Back to list
        </Link>
      </Card>
    );
  }

  const { assessment, assignment } = data;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={assessment.title}
        description={assessment.description || undefined}
        actions={
          <Link
            to="/my-assessments"
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← Back
          </Link>
        }
      />

      {isSubmitted && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Your score</span>
          <Badge tone="success" className="text-base">
            {assignment.score} / {assignment.maxScore}
          </Badge>
        </Card>
      )}

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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/my-assessments')}>
              Cancel
            </Button>
            <Button type="submit" disabled={!allAnswered || submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit assessment'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
