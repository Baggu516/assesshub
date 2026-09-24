import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Badge, Card, Skeleton } from '@/components/ui';
import { AssessmentFormRunner } from '@/components/assessments/AssessmentFormRunner';
import { CbtAttemptRunner } from '@/components/assessments/CbtAttemptRunner';
import { ExamReadinessGate } from '@/components/assessments/ExamReadinessGate';
import { useAuth } from '@/context/AuthContext';
import {
  recordFullscreenExit,
  useAssignmentQuery,
  useAssessmentMutations,
  type AssessmentQuestion,
  type ExamKind,
} from '@/hooks/api/useAssessments';

export function TakeAssessmentPage({ kind = 'assessment' }: { kind?: ExamKind }) {
  const online = kind === 'online_exam';
  const mine = online ? '/my-online-exams' : '/my-assessments';
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [admitted, setAdmitted] = useState(false);
  const [bypassCamera, setBypassCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  cameraRef.current = cameraStream;
  const { data, isLoading, isError, isPlaceholderData, error: loadError, refetch } = useAssignmentQuery(
    assignmentId,
    { preview: online && !admitted && !bypassCamera }
  );
  const { submit } = useAssessmentMutations();
  const [error, setError] = useState<string | null>(null);
  const isSubmitted = data?.assignment.status === 'submitted';

  useEffect(() => {
    return () => {
      cameraRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!isSubmitted) return;
    cameraRef.current?.getTracks().forEach((track) => track.stop());
  }, [isSubmitted]);

  useEffect(() => {
    if (!online || !data?.assessment || data.assessment.cameraMonitor) return;
    const untimed = (data.assessment.durationMinutes ?? 60) <= 0;
    if (!data.assignment.startedAt && !untimed) setBypassCamera(true);
  }, [online, data]);

  const answerMap = useMemo(() => {
    if (!isSubmitted || !data?.assignment.answers) return new Map();
    return new Map(data.assignment.answers.map((a) => [a.questionId, a]));
  }, [isSubmitted, data?.assignment.answers]);

  const studentName = useMemo(() => {
    const parts = [user?.firstName, user?.lastName].filter(Boolean);
    return parts.join(' ').trim() || user?.email || 'Student';
  }, [user]);

  const handleCbtSubmit = async (
    answers: { questionId: string; selectedOptionIds: string[]; textAnswer: string }[],
    submitReason: 'manual' | 'timer' | 'fullscreen_exits'
  ) => {
    if (!assignmentId) return;
    setError(null);
    try {
      await submit.mutateAsync({ assignmentId, answers, submitReason });
      try {
        localStorage.removeItem(`assessment-answers-${assignmentId}`);
      } catch {
        /* ignore */
      }
      await refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to submit');
      toast.error(msg || 'Failed to submit');
      await refetch();
      throw err;
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
    const unavailable =
      (loadError as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      (isError ? 'This assessment is not available yet.' : 'Assessment not found.');
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-slate-500">
        {unavailable}{' '}
        <Link to={mine} className="text-brand-600 hover:underline dark:text-brand-400">
          Back to list
        </Link>
      </Card>
    );
  }

  const { assessment, assignment } = data;
  const resultsVisible = Boolean(assignment.resultsVisible);

  // CBT live attempt
  if (!isSubmitted) {
    return (
      <>
        {error ? (
          <div className="fixed left-0 right-0 top-0 z-[90] border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {online && assessment.cameraMonitor && (!admitted || isPlaceholderData) ? (
          <ExamReadinessGate
            title={assessment.title}
            durationMinutes={assessment.durationMinutes ?? 60}
            alreadyStarted={Boolean(assignment.startedAt)}
            backTo={mine}
            starting={admitted}
            onProceed={(stream) => {
              setCameraStream(stream);
              setAdmitted(true);
            }}
          />
        ) : online && !assessment.cameraMonitor && isPlaceholderData && !assignment.startedAt ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28" />
          </div>
        ) : online ? (
          <CbtAttemptRunner
            title={assessment.title}
            studentName={studentName}
            questions={assessment.questions}
            sections={assessment.sections}
            durationMinutes={assessment.durationMinutes ?? 60}
            initialRemainingSeconds={
              assignment.remainingSeconds === undefined ? null : assignment.remainingSeconds
            }
            storageKey={`assessment-answers-${assignment.id}`}
            submitting={submit.isPending}
            assignmentId={assignment.id}
            lockFullscreen
            fullscreenExitCount={assignment.fullscreenExitCount || 0}
            maxFullscreenExits={assignment.maxFullscreenExits || 3}
            cameraStream={assessment.cameraMonitor ? cameraStream : null}
            onCameraStream={assessment.cameraMonitor ? setCameraStream : undefined}
            onFullscreenExit={
              assignmentId ? () => recordFullscreenExit(assignmentId) : undefined
            }
            onSubmit={handleCbtSubmit}
          />
        ) : (
          <AssessmentFormRunner
            title={assessment.title}
            description={assessment.description}
            questions={assessment.questions}
            initialRemainingSeconds={
              assignment.remainingSeconds === undefined ? null : assignment.remainingSeconds
            }
            storageKey={`assessment-answers-${assignment.id}`}
            submitting={submit.isPending}
            onSubmit={(answers, reason) => handleCbtSubmit(answers, reason || 'manual')}
          />
        )}
      </>
    );
  }

  if (!resultsVisible) {
    return (
      <SubmissionHoldView
        title={assessment.title}
        description={assessment.description}
        submittedAt={assignment.submittedAt}
        online={online}
        onBack={() => navigate(mine)}
      />
    );
  }

  const showAnswerKey = assessment.showAnswersAfterSubmit !== false;

  return (
    <StudentResultView
      title={assessment.title}
      description={assessment.description}
      submittedAt={assignment.submittedAt}
      startedAt={assignment.startedAt}
      score={assignment.score}
      maxScore={assignment.maxScore}
      online={online}
      showAnswerKey={showAnswerKey}
      questions={assessment.questions}
      answerMap={answerMap}
      onBack={() => navigate(mine)}
    />
  );
}

const CONFETTI_COLORS = ['#34d399', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf', '#fb923c'];

function formatHoldDate(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();

    const pieces = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: -24 - Math.random() * canvas.height * 0.55,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vy: 1.4 + Math.random() * 2.6,
      vx: -1.4 + Math.random() * 2.8,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      w: 5 + Math.random() * 6,
      h: 7 + Math.random() * 8,
    }));

    let frame = 0;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.025;
        piece.rot += piece.vr;
        if (piece.y < canvas.height + 30) alive = true;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.fillStyle = piece.color;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }
      frame += 1;
      if (alive && frame < 420) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

function SubmissionHoldView({
  title,
  description,
  submittedAt,
  online,
  onBack,
}: {
  title: string;
  description?: string;
  submittedAt?: string | null;
  online: boolean;
  onBack: () => void;
}) {
  const dots = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        top: `${(i * 29) % 100}%`,
        size: 6 + (i % 5) * 3,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );
  const when = formatHoldDate(submittedAt);
  const blurb = (description || '').trim();
  const meta = [blurb.length > 48 ? `${blurb.slice(0, 48).trim()}…` : blurb, when].filter(Boolean).join(' · ');
  const examLabel = online ? 'online assessment' : 'assessment';

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[linear-gradient(115deg,#e8f7f0_0%,#f4f8f5_46%,#f8f0e6_100%)] dark:bg-[linear-gradient(115deg,#10211c_0%,#121820_52%,#211c16_100%)]">
      <div className="relative flex min-h-full flex-col px-4 py-6 md:px-8 md:py-8">
      <ConfettiBurst />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {dots.map((dot) => (
          <span
            key={dot.id}
            className="absolute rounded-full opacity-70"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              backgroundColor: dot.color,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800/80 dark:text-emerald-200/80">
            {online ? 'Online assessment result' : 'Assessment result'}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {meta ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta}</p> : null}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span aria-hidden>←</span>
          {online ? 'All online assessments' : 'All assessments'}
        </button>
      </div>

      <div className="relative z-10 mx-auto my-auto w-full max-w-md shrink-0 rounded-3xl bg-white px-8 py-10 text-center shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-xl font-bold text-emerald-900 dark:text-emerald-100">
          Thank you for attempting!
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Your {examLabel} was submitted{when ? ` on ${when}` : ''}. Great work completing it.
        </p>
        <p className="mt-6 text-sm font-bold text-slate-900 dark:text-white">Results on hold</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          The academy will release results soon. You will get an email when they are available — then open them here on the site.
        </p>
        <p className="mt-5 text-xs text-slate-400">Scores are not shared by email.</p>
      </div>
      </div>
    </div>
  );
}

function resultMood(percentage: number) {
  if (percentage >= 80) {
    return {
      emoji: '😄',
      title: 'Excellent',
      message: 'You have a strong grip on this topic.',
    };
  }
  if (percentage >= 50) {
    return {
      emoji: '🙂',
      title: 'Good effort',
      message: 'You are close. Review the questions you missed.',
    };
  }
  return {
    emoji: '😔',
    title: 'Needs work',
    message: 'This topic needs another round. Ask your teacher for help.',
  };
}

function formatTaken(seconds: number | null) {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

function formatScore(n: number | null | undefined) {
  const value = Number(n) || 0;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function downloadResultImage(
  title: string,
  mood: { emoji: string; title: string; message: string },
  scoreLabel: string,
  percentage: number,
  stats: { label: string; value: string; color: string }[]
) {
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 560;
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(2, 2);
  ctx.fillStyle = '#f4f8f5';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(40, 36, width - 80, height - 72, 28);
  ctx.fill();
  ctx.font = '64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mood.emoji, width / 2, 130);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(mood.title, width / 2, 190);
  ctx.fillStyle = '#64748b';
  ctx.font = '18px sans-serif';
  ctx.fillText(mood.message, width / 2, 226);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(scoreLabel, width / 2, 300);
  ctx.fillStyle = '#047857';
  ctx.font = '18px sans-serif';
  ctx.fillText(`${percentage}% score`, width / 2, 334);
  stats.forEach((stat, index) => {
    const x = 80 + index * 200;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(x, 380, 180, 100, 16);
    ctx.fill();
    ctx.fillStyle = stat.color;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(stat.value, x + 90, 424);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(stat.label, x + 90, 454);
  });
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${title.replace(/[^\w.-]+/g, '-') || 'result'}-result.png`;
  link.click();
}

function StudentResultView({
  title,
  description,
  submittedAt,
  startedAt,
  score,
  maxScore,
  online,
  showAnswerKey,
  questions,
  answerMap,
  onBack,
}: {
  title: string;
  description?: string;
  submittedAt?: string | null;
  startedAt?: string | null;
  score: number | null;
  maxScore: number;
  online: boolean;
  showAnswerKey: boolean;
  questions: AssessmentQuestion[];
  answerMap: Map<string, { selectedOptionIds?: string[]; textAnswer?: string; isCorrect?: boolean; pointsEarned?: number }>;
  onBack: () => void;
}) {
  const summary = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    for (const question of questions) {
      const saved = answerMap.get(question.id || '');
      const hasResponse = Boolean(
        saved &&
          ((saved.selectedOptionIds || []).length > 0 || String(saved.textAnswer || '').trim())
      );
      if (!hasResponse) skipped += 1;
      else if (saved?.isCorrect) correct += 1;
      else wrong += 1;
    }
    const earned = Number(score) || 0;
    const total = Number(maxScore) || 0;
    const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;
    const timeTaken =
      startedAt && submittedAt
        ? Math.max(0, Math.floor((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000))
        : null;
    return { correct, wrong, skipped, earned, total, percentage, timeTaken };
  }, [questions, answerMap, score, maxScore, startedAt, submittedAt]);

  const mood = resultMood(summary.percentage);
  const when = formatHoldDate(submittedAt);
  const blurb = (description || '').trim();
  const meta = [blurb.length > 48 ? `${blurb.slice(0, 48).trim()}…` : blurb, when].filter(Boolean).join(' · ');
  const scoreLabel = `${formatScore(summary.earned)}/${formatScore(summary.total)}`;
  const stats = [
    { label: 'Correct', value: String(summary.correct), color: '#059669' },
    { label: 'Wrong', value: String(summary.wrong), color: '#e11d48' },
    { label: 'Skipped', value: String(summary.skipped), color: '#64748b' },
    { label: 'Time taken', value: formatTaken(summary.timeTaken), color: '#0f172a' },
  ];

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[linear-gradient(115deg,#e8f7f0_0%,#f4f8f5_46%,#f8f0e6_100%)] dark:bg-[linear-gradient(115deg,#10211c_0%,#121820_52%,#211c16_100%)]">
      <div className="relative flex min-h-full flex-col">
      <ConfettiBurst />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800/80 dark:text-emerald-200/80">
              {online ? 'Online assessment result' : 'Assessment result'}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {meta ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{meta}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadResultImage(title, mood, scoreLabel, summary.percentage, stats)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5V6a2 2 0 012-2h2.5M16.5 4H19a2 2 0 012 2v2.5M21 15.5V18a2 2 0 01-2 2h-2.5M7.5 20H5a2 2 0 01-2-2v-2.5" />
                <circle cx="12" cy="12" r="3.25" />
              </svg>
              Screenshot result
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span aria-hidden>←</span>
              {online ? 'All online assessments' : 'All assessments'}
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] dark:bg-slate-900 sm:px-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
            <span aria-hidden>{mood.emoji}</span>
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-slate-900 dark:text-white">{mood.title}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{mood.message}</p>
          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatScore(summary.earned)}
            <span className="text-3xl font-semibold text-slate-400">/{formatScore(summary.total)}</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {summary.percentage}% score
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {showAnswerKey ? (
          <div className="mt-8 space-y-4 pb-8">
            {questions.map((question, index) => {
              const qid = question.id || '';
              const saved = answerMap.get(qid);
              return (
                <ReviewQuestion
                  key={qid || index}
                  question={question}
                  index={index}
                  selectedOptionIds={(saved?.selectedOptionIds || []).map(String)}
                  textAnswer={saved?.textAnswer || ''}
                  isCorrect={saved?.isCorrect}
                  pointsEarned={saved?.pointsEarned}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            Your teacher has not released the answer key for this test.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function ReviewQuestion({
  question,
  index,
  selectedOptionIds,
  textAnswer,
  isCorrect,
  pointsEarned,
}: {
  question: AssessmentQuestion;
  index: number;
  selectedOptionIds: string[];
  textAnswer: string;
  isCorrect?: boolean;
  pointsEarned?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div
        className={clsx(
          'absolute inset-y-0 left-0 w-1',
          isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
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
          <Badge tone="neutral">
            {question.points} pt{question.points !== 1 ? 's' : ''}
          </Badge>
        </div>
        <Badge tone={isCorrect ? 'success' : 'danger'}>
          {isCorrect ? `Correct (+${pointsEarned ?? 0})` : 'Incorrect'}
        </Badge>

        {question.type === 'short_answer' ? (
          <div className="text-sm text-slate-700 dark:text-slate-200">
            Your answer: <span className="font-medium">{textAnswer || '—'}</span>
            {question.acceptedAnswers?.length ? (
              <p className="mt-1 text-xs text-slate-500">
                Accepted: {question.acceptedAnswers.join(', ')}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {question.options.map((opt) => {
              const selected = selectedOptionIds.includes(opt.id || '');
              return (
                <li
                  key={opt.id}
                  className={clsx(
                    'rounded-lg border px-3 py-2',
                    selected
                      ? 'border-brand-400 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-500/10'
                      : 'border-slate-200 dark:border-slate-700',
                    opt.isCorrect && 'ring-1 ring-emerald-400'
                  )}
                >
                  {opt.text}
                  {opt.isCorrect ? (
                    <span className="ml-2 text-xs font-medium text-emerald-600">(correct)</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
