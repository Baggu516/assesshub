import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { saveQuizProgress, type AssessmentQuestion } from '@/hooks/api/useAssessments';

type AnswerState = {
  selectedOptionIds: string[];
  textAnswer: string;
};

const CHOICE_STYLES = [
  'bg-rose-500 hover:bg-rose-400',
  'bg-sky-500 hover:bg-sky-400',
  'bg-amber-400 hover:bg-amber-300 text-amber-950',
  'bg-emerald-500 hover:bg-emerald-400',
  'bg-violet-500 hover:bg-violet-400',
  'bg-orange-500 hover:bg-orange-400',
];

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

type RevealState = {
  questionId: string;
  isCorrect: boolean;
  correctOptionId: string;
};

export function QuizPlayRunner({
  title,
  questions,
  assignmentId,
  revealAnswers = false,
  initialRemainingSeconds,
  submitting,
  onSubmit,
}: {
  title: string;
  questions: AssessmentQuestion[];
  assignmentId?: string;
  revealAnswers?: boolean;
  initialRemainingSeconds: number | null;
  submitting: boolean;
  onSubmit: (
    answers: { questionId: string; selectedOptionIds: string[]; textAnswer: string }[],
    submitReason?: 'manual' | 'timer'
  ) => Promise<void>;
}) {
  const submittedRef = useRef(false);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState<RevealState | null>(null);
  const [remaining, setRemaining] = useState(
    initialRemainingSeconds == null ? null : Math.max(0, initialRemainingSeconds)
  );

  const question = questions[index];
  const total = questions.length;

  const finish = async (reason: 'manual' | 'timer', nextAnswers = answers) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const body = questions.map((q) => ({
      questionId: q.id || '',
      selectedOptionIds: nextAnswers[q.id || '']?.selectedOptionIds || [],
      textAnswer: '',
    }));
    try {
      await onSubmit(body, reason);
    } catch {
      submittedRef.current = false;
    }
  };

  useEffect(() => {
    if (remaining == null) return undefined;
    if (remaining <= 0) {
      void finish('timer');
      return undefined;
    }
    const id = window.setTimeout(() => setRemaining((value) => (value == null ? value : value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  const choose = (optionId: string) => {
    if (!question || locked || submitting || submittedRef.current) return;
    const questionId = question.id || '';
    const nextAnswers = {
      ...answers,
      [questionId]: { selectedOptionIds: [optionId], textAnswer: '' },
    };
    setAnswers(nextAnswers);
    setLocked(true);
    const body = questions.map((q) => ({
      questionId: q.id || '',
      selectedOptionIds: nextAnswers[q.id || '']?.selectedOptionIds || [],
      textAnswer: '',
    }));
    const saved = assignmentId
      ? saveQuizProgress(assignmentId, body).catch(() => undefined)
      : Promise.resolve(undefined);

    if (!revealAnswers) {
      void saved.then(() => {
        window.setTimeout(() => {
          if (index >= total - 1) {
            void finish('manual', nextAnswers);
            return;
          }
          setIndex((current) => current + 1);
          setLocked(false);
        }, 420);
      });
      return;
    }

    void saved.then((result) => {
      const mark = result?.reveal?.find((item) => item.questionId === questionId);
      if (!mark) {
        setLocked(false);
        return;
      }
      setRevealed(mark);
    });
  };

  const goNext = () => {
    if (!revealed || submitting) return;
    if (index >= total - 1) {
      void finish('manual');
      return;
    }
    setRevealed(null);
    setIndex((current) => current + 1);
    setLocked(false);
  };

  if (!question) return null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-xs text-slate-400">
            Question {index + 1} of {total}
          </p>
        </div>
        {remaining != null ? (
          <p className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm dark:bg-slate-900 dark:text-white">
            {formatClock(remaining)}
          </p>
        ) : null}
      </div>

      <div className="mb-5 flex gap-1.5">
        {questions.map((q, i) => (
          <span
            key={q.id || i}
            className={clsx(
              'h-1.5 flex-1 rounded-full',
              i < index ? 'bg-brand-500' : i === index ? 'bg-brand-300' : 'bg-slate-200 dark:bg-slate-700'
            )}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {question.prompt}
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(question.options || []).map((option, optionIndex) => {
            const selected = answers[question.id || '']?.selectedOptionIds.includes(option.id || '');
            const showing = revealed?.questionId === (question.id || '');
            const isRight = showing && option.id === revealed.correctOptionId;
            const isWrongPick = showing && selected && !revealed.isCorrect;
            return (
              <button
                key={option.id || optionIndex}
                type="button"
                disabled={locked || submitting}
                onClick={() => option.id && choose(option.id)}
                className={clsx(
                  'relative rounded-2xl px-5 py-5 text-left text-lg font-semibold text-white shadow-md transition disabled:cursor-default',
                  !showing && CHOICE_STYLES[optionIndex % CHOICE_STYLES.length],
                  !showing && selected && 'ring-4 ring-white ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-950',
                  isRight && 'quiz-pop bg-emerald-500 ring-4 ring-emerald-200',
                  isWrongPick && 'quiz-shake bg-rose-600 ring-4 ring-rose-200',
                  showing && !isRight && !isWrongPick && 'bg-slate-300 text-slate-500'
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{option.text}</span>
                  {isRight ? <span aria-label="Correct">✓</span> : null}
                  {isWrongPick ? <span aria-label="Wrong">✕</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        {revealAnswers && revealed ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className={clsx('text-sm font-semibold', revealed.isCorrect ? 'text-emerald-600' : 'text-rose-600')}>
              {revealed.isCorrect ? 'Correct' : 'Not quite'}
            </p>
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {index >= total - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">
        {revealAnswers
          ? 'After you answer, the result shows here. Next unlocks once you see it.'
          : 'Your choice moves you to the next question.'}
      </p>
    </div>
  );
}
