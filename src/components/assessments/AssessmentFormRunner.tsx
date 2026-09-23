import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { AssessmentQuestion } from '@/hooks/api/useAssessments';

type AnswerState = {
  selectedOptionIds: string[];
  textAnswer: string;
};

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function optionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function isAnswered(q: AssessmentQuestion, a?: AnswerState) {
  if (!a) return false;
  if (q.type === 'short_answer') return a.textAnswer.trim().length > 0;
  return a.selectedOptionIds.length > 0;
}

function readAnswers(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {} as Record<string, AnswerState>;
    const parsed = JSON.parse(raw);
    return (parsed.answers || {}) as Record<string, AnswerState>;
  } catch {
    return {};
  }
}

function choiceHint(type: AssessmentQuestion['type']) {
  if (type === 'multi_select') return 'Select all that apply';
  if (type === 'short_answer') return '1–2 words';
  return 'Select one';
}

export function AssessmentFormRunner({
  title,
  description,
  questions,
  initialRemainingSeconds,
  storageKey,
  submitting,
  onSubmit,
}: {
  title: string;
  description?: string;
  questions: AssessmentQuestion[];
  initialRemainingSeconds: number | null;
  storageKey: string;
  submitting: boolean;
  onSubmit: (
    answers: { questionId: string; selectedOptionIds: string[]; textAnswer: string }[],
    submitReason?: 'manual' | 'timer'
  ) => Promise<void>;
}) {
  const submittedRef = useRef(false);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => readAnswers(storageKey));
  const [remaining, setRemaining] = useState(
    initialRemainingSeconds == null ? null : Math.max(0, initialRemainingSeconds)
  );

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id || ''])).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const lowTime = remaining != null && remaining > 0 && remaining <= 60;

  const sections = useMemo(() => {
    const names: string[] = [];
    for (const q of questions) {
      const name = (q.section || '').trim();
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  }, [questions]);
  const showSections = sections.length > 1;

  const buildPayload = useCallback(
    () =>
      questions.map((q) => {
        const a = answers[q.id || ''] || { selectedOptionIds: [], textAnswer: '' };
        return {
          questionId: q.id!,
          selectedOptionIds: a.selectedOptionIds,
          textAnswer: a.textAnswer,
        };
      }),
    [questions, answers]
  );

  const handleSubmit = useCallback(() => {
    if (submittedRef.current || submitting) return;
    const unanswered = questions.length - questions.filter((q) => isAnswered(q, answers[q.id || ''])).length;
    if (unanswered > 0) {
      const ok = window.confirm(
        `You have not answered ${unanswered} question${unanswered === 1 ? '' : 's'}. Submit anyway?`
      );
      if (!ok) return;
    }
    submittedRef.current = true;
    Promise.resolve(onSubmit(buildPayload(), 'manual')).catch(() => {
      submittedRef.current = false;
    });
  }, [submitting, questions, answers, onSubmit, buildPayload]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (remaining == null || remaining <= 0) return undefined;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev == null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining == null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) {
      submittedRef.current = true;
      Promise.resolve(onSubmit(buildPayload(), 'timer')).catch(() => {
        submittedRef.current = false;
      });
    }
  }, [remaining, onSubmit, buildPayload]);

  useEffect(() => {
    try {
      const previous = readAnswers(storageKey);
      localStorage.setItem(storageKey, JSON.stringify({ answers: { ...previous, ...answers } }));
    } catch {
      /* ignore */
    }
  }, [answers, storageKey]);

  const setAnswer = (qid: string, next: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [qid]: next }));
  };

  const blurb = (description || '').trim();

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[linear-gradient(115deg,#e8f7f0_0%,#f4f8f5_42%,#f8f0e6_100%)] dark:bg-[linear-gradient(115deg,#10211c_0%,#121820_52%,#211c16_100%)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">{title}</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {[blurb, `${answeredCount} of ${questions.length} answered`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {remaining != null ? (
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums',
                    lowTime
                      ? 'animate-pulse bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                  )}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                    <circle cx="12" cy="12" r="8" />
                    <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
                  </svg>
                  {formatClock(remaining)}
                </span>
              ) : null}
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
          <div className="h-1.5 bg-emerald-100 dark:bg-emerald-950">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {lowTime ? (
          <p className="text-sm font-medium text-rose-700">
            Less than a minute left. Your answers submit automatically when the timer ends.
          </p>
        ) : null}

        {questions.map((question, index) => {
          const qid = question.id || '';
          const answer = answers[qid] || { selectedOptionIds: [], textAnswer: '' };
          const section = (question.section || '').trim();
          const previousSection = (questions[index - 1]?.section || '').trim();
          const showHeading = showSections && section && section !== previousSection;
          return (
            <div key={qid || index}>
              {showHeading ? (
                <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{section}</p>
              ) : null}
              <article className="rounded-2xl bg-white px-5 py-5 shadow-sm dark:bg-slate-900 sm:px-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-500">Q{index + 1}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {choiceHint(question.type)}
                  </span>
                  <span className="text-slate-400">
                    {question.points} mark{question.points === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{question.prompt}</p>

                {question.type === 'short_answer' ? (
                  <input
                    type="text"
                    className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="1–2 words"
                    maxLength={100}
                    value={answer.textAnswer}
                    onChange={(e) => setAnswer(qid, { ...answer, textAnswer: e.target.value })}
                  />
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {question.options.map((opt, displayIndex) => {
                      const id = opt.id || '';
                      const selected =
                        question.type === 'single_select'
                          ? answer.selectedOptionIds[0] === id
                          : answer.selectedOptionIds.includes(id);
                      return (
                        <label
                          key={id || displayIndex}
                          className={clsx(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                            selected
                              ? 'border-emerald-600 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950'
                          )}
                        >
                          <input
                            type={question.type === 'multi_select' ? 'checkbox' : 'radio'}
                            name={`question-${qid}`}
                            checked={selected}
                            onChange={() => {
                              if (question.type === 'single_select') {
                                setAnswer(qid, { ...answer, selectedOptionIds: id ? [id] : [] });
                              } else {
                                const next = selected
                                  ? answer.selectedOptionIds.filter((x) => x !== id)
                                  : [...answer.selectedOptionIds, id];
                                setAnswer(qid, { ...answer, selectedOptionIds: next });
                              }
                            }}
                            className="h-4 w-4 shrink-0 accent-emerald-700"
                          />
                          <span className="w-5 shrink-0 font-semibold text-slate-500">{optionLabel(displayIndex)}</span>
                          <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm dark:bg-slate-900">
          <p className="text-sm text-slate-500">
            {allAnswered
              ? 'All questions answered. You can submit now.'
              : `${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? '' : 's'} left.`}
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit test'}
          </button>
        </div>
      </div>
    </div>
  );
}
