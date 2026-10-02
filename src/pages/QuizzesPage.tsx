import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { JoinQuizModal, QuizCodeModal } from '@/components/quiz/QuizJoin';
import { Badge, Button, Card, EmptyState, FormField, Input, Modal, PageHeader, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  useAssessmentsQuery,
  useAssessmentMutations,
  useJoinQuiz,
  useMyAssignmentsQuery,
  type Assessment,
} from '@/hooks/api/useAssessments';

type DraftQuestion = {
  prompt: string;
  options: string[];
  correct: number;
};

function blankQuestion(choiceCount: number): DraftQuestion {
  return { prompt: '', options: Array.from({ length: choiceCount }, () => ''), correct: 0 };
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              value === option.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function resizeOptions(options: string[], count: number) {
  const next = options.slice(0, count);
  while (next.length < count) next.push('');
  return next;
}

export function QuizzesPage() {
  const { user } = useAuth();
  const isStudent = user?.hierarchyRole === 'user';
  const navigate = useNavigate();
  const { yearId } = useAcademicYear();
  const { data, isLoading } = useAssessmentsQuery({ kind: 'quiz' }, !isStudent);
  const { data: mine, isLoading: mineLoading } = useMyAssignmentsQuery(
    yearId || undefined,
    'quiz',
    isStudent
  );
  const { create, publish } = useAssessmentMutations();
  const joinQuiz = useJoinQuiz();
  const [params, setParams] = useSearchParams();
  const autoJoin = useRef(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [choiceCount, setChoiceCount] = useState(4);
  const [quizShuffle, setQuizShuffle] = useState<'options' | 'questions'>('options');
  const [revealAnswers, setRevealAnswers] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion(4)]);
  const [codeQuiz, setCodeQuiz] = useState<Assessment | null>(null);

  useEffect(() => {
    if (!isStudent || autoJoin.current) return;
    const code = (params.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    autoJoin.current = true;
    setParams({}, { replace: true });
    void joinQuiz
      .mutateAsync(code)
      .then((assignment) => navigate(`/quizzes/play/${assignment.id}`))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || 'Could not join that quiz');
      });
  }, [isStudent, joinQuiz, navigate, params, setParams]);

  const quizzes = data?.assessments ?? [];
  const past = (mine?.assignments ?? []).filter((a) => a.status === 'submitted');
  const saving = create.isPending || publish.isPending;

  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setQuestions((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const saveQuiz = async () => {
    const durationMinutes = Number(minutes);
    if (!title.trim()) {
      toast.error('Add a title');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      toast.error('Set a time of at least 1 minute');
      return;
    }
    const built = questions.map((q, order) => {
      const options = q.options.map((text) => text.trim()).filter(Boolean);
      return {
        type: 'single_select' as const,
        prompt: q.prompt.trim(),
        points: 1,
        order,
        options: q.options
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ text, isCorrect: index === q.correct })),
        optionCount: options.length,
        correct: q.correct,
      };
    });
    if (built.some((q) => !q.prompt || q.optionCount < 2 || q.correct >= q.optionCount)) {
      toast.error('Each question needs a prompt, at least two choices, and one correct choice');
      return;
    }
    try {
      const created = await create.mutateAsync({
        kind: 'quiz',
        title: title.trim(),
        durationMinutes,
        quizShuffle,
        revealAnswers,
        questions: built.map(({ optionCount: _count, correct: _correct, ...question }) => question),
      });
      const launched = await publish.mutateAsync(created.id);
      setEditorOpen(false);
      setTitle('');
      setMinutes('10');
      setChoiceCount(4);
      setQuizShuffle('options');
      setRevealAnswers(false);
      setQuestions([blankQuestion(4)]);
      setCodeQuiz(launched);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not create the quiz');
    }
  };

  const launchExisting = async (quiz: Assessment) => {
    try {
      const launched = await publish.mutateAsync(quiz.id);
      setCodeQuiz(launched);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not launch the quiz');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isStudent ? 'Student' : 'Teacher'}
        title="Quizzes"
        description={
          isStudent
            ? 'Past quizzes stay on this page. Join a live quiz with the code or QR your teacher shows.'
            : 'Create a quiz here, launch it, then share the code or QR. This is separate from Assessments.'
        }
        actions={
          isStudent ? (
            <Button onClick={() => setJoinOpen(true)}>Join with code / QR</Button>
          ) : (
            <Button onClick={() => setEditorOpen(true)}>+ New quiz</Button>
          )
        }
      />

      {isStudent ? (
        mineLoading ? (
          <Skeleton className="h-48" />
        ) : past.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No past quizzes yet"
              description="When you finish a quiz, it will show up here."
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((quiz) => (
              <Card key={quiz.id} className="p-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {quiz.assessmentTitle || 'Quiz'}
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  {quiz.resultsVisible && quiz.score != null
                    ? `Score ${quiz.score}/${quiz.maxScore}`
                    : 'Submitted'}
                </p>
                <div className="pt-4">
                  <Link to={`/quizzes/play/${quiz.id}`}>
                    <Button size="sm" variant="secondary">
                      {quiz.resultsVisible ? 'View results' : 'View submission'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : quizzes.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No quizzes yet"
            description="Create a quiz, add questions, and launch it. Students join with the code or QR."
            action={<Button onClick={() => setEditorOpen(true)}>Create quiz</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-col p-5">
              <div className="mb-2">
                <Badge tone={quiz.status === 'published' ? 'success' : 'neutral'}>
                  {quiz.status === 'published' ? 'Live' : 'Draft'}
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{quiz.title}</h3>
              <p className="mt-2 text-xs text-slate-500">
                {quiz.questionCount ?? quiz.questions?.length ?? 0} questions · {quiz.durationMinutes ?? 10} min
                {quiz.joinCode ? ` · Code ${quiz.joinCode}` : ''}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link to={`/quizzes/${quiz.id}/results`}>
                  <Button size="sm" variant="secondary">
                    View results
                  </Button>
                </Link>
                {quiz.status === 'published' && quiz.joinCode ? (
                  <Button size="sm" onClick={() => setCodeQuiz(quiz)}>
                    Show code
                  </Button>
                ) : (
                  <Button size="sm" disabled={publish.isPending} onClick={() => void launchExisting(quiz)}>
                    Launch
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => {
          if (!saving) setEditorOpen(false);
        }}
        title="New quiz"
        description="A title, a few choices, then launch."
        size="lg"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void saveQuiz()}>
              {saving ? 'Launching…' : 'Create and launch'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <FormField label="Title" htmlFor="quiz-title" required>
            <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday quiz" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Minutes" htmlFor="quiz-minutes">
              <Input
                id="quiz-minutes"
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </FormField>
            <FormField label="Choices" htmlFor="quiz-choices">
              <Input
                id="quiz-choices"
                type="number"
                min={2}
                max={6}
                value={choiceCount}
                onChange={(e) => {
                  const next = Math.min(6, Math.max(2, Number(e.target.value) || 2));
                  setChoiceCount(next);
                  setQuestions((rows) =>
                    rows.map((row) => ({
                      ...row,
                      options: resizeOptions(row.options, next),
                      correct: Math.min(row.correct, next - 1),
                    }))
                  );
                }}
              />
            </FormField>
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
            <Segment
              label="Question order"
              value={quizShuffle}
              onChange={setQuizShuffle}
              options={[
                { id: 'options', label: 'Same' },
                { id: 'questions', label: 'Mixed' },
              ]}
            />
            <Segment
              label="After an answer"
              value={revealAnswers ? 'reveal' : 'hide'}
              onChange={(next) => setRevealAnswers(next === 'reveal')}
              options={[
                { id: 'hide', label: 'Hide' },
                { id: 'reveal', label: 'Reveal' },
              ]}
            />
            <p className="text-xs leading-relaxed text-slate-400">
              {quizShuffle === 'options'
                ? 'Same question order. Choices are mixed for each student.'
                : 'Questions and choices are both mixed for each student.'}{' '}
              {revealAnswers
                ? 'Correct or wrong shows before Next.'
                : 'The next question opens immediately.'}
            </p>
          </div>

          <div className="space-y-3">
            {questions.map((question, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question {index + 1}</p>
                  {questions.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => setQuestions((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <Input
                  id={`quiz-q-${index}`}
                  value={question.prompt}
                  placeholder="Write the question"
                  aria-label={`Question ${index + 1}`}
                  onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                />
                <div className="mt-2 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const marked = question.correct === optionIndex;
                    return (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Mark choice ${optionIndex + 1} correct`}
                          aria-pressed={marked}
                          onClick={() => updateQuestion(index, { correct: optionIndex })}
                          className={clsx(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                            marked
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-slate-300 text-transparent hover:border-brand-400 dark:border-slate-600'
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        </button>
                        <Input
                          value={option}
                          placeholder={`Choice ${optionIndex + 1}`}
                          onChange={(e) => {
                            const options = [...question.options];
                            options[optionIndex] = e.target.value;
                            updateQuestion(index, { options });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((rows) => [...rows, blankQuestion(choiceCount)])}
              className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300"
            >
              + Add question
            </button>
          </div>
        </div>
      </Modal>

      {codeQuiz?.joinCode ? (
        <QuizCodeModal
          open
          title={codeQuiz.title}
          code={codeQuiz.joinCode}
          onClose={() => setCodeQuiz(null)}
        />
      ) : null}

      {isStudent ? (
        <JoinQuizModal
          open={joinOpen}
          joining={joinQuiz.isPending}
          onClose={() => setJoinOpen(false)}
          onJoin={(code) => {
            void joinQuiz
              .mutateAsync(code)
              .then((assignment) => {
                setJoinOpen(false);
                navigate(`/quizzes/play/${assignment.id}`);
              })
              .catch((err: unknown) => {
                const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                toast.error(msg || 'Could not join that quiz');
              });
          }}
        />
      ) : null}
    </div>
  );
}
