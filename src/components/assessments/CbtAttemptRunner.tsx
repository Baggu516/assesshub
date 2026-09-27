import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { uploadProctorCapture, type AssessmentQuestion } from '@/hooks/api/useAssessments';
import { SubmitConfirmDialog } from './SubmitConfirmDialog';

export type CbtAnswerState = {
  selectedOptionIds: string[];
  textAnswer: string;
};

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function optionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function isAnswered(q: AssessmentQuestion, a?: CbtAnswerState) {
  if (!a) return false;
  if (q.type === 'short_answer') return a.textAnswer.trim().length > 0;
  return a.selectedOptionIds.length > 0;
}

function paletteTone({ answered, marked, visited }: { answered: boolean; marked: boolean; visited: boolean }) {
  if (answered && marked) return 'bg-violet-600 text-white ring-2 ring-violet-300';
  if (marked) return 'bg-violet-500 text-white';
  if (answered) return 'bg-emerald-500 text-white';
  if (visited) return 'bg-red-500 text-white';
  return 'bg-slate-300 text-slate-700';
}

function readStored(storageKey: string | undefined) {
  if (!storageKey) {
    return { answers: {} as Record<string, CbtAnswerState>, marked: {} as Record<string, boolean>, visited: {} as Record<string, boolean>, currentIndex: 0 };
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { answers: {}, marked: {}, visited: {}, currentIndex: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      answers: (parsed.answers || {}) as Record<string, CbtAnswerState>,
      marked: (parsed.marked || {}) as Record<string, boolean>,
      visited: (parsed.visited || {}) as Record<string, boolean>,
      currentIndex: Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0,
    };
  } catch {
    return { answers: {}, marked: {}, visited: {}, currentIndex: 0 };
  }
}

function typeLabel(type: AssessmentQuestion['type']) {
  if (type === 'multi_select') return 'MCQ Multiple';
  if (type === 'short_answer') return 'Short answer';
  return 'MCQ Single';
}

/**
 * CBT / CBS-style exam shell: one question, timer, palette, mark for review.
 */
function isFullscreen() {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

async function requestFullscreenSafe(element: HTMLElement | null) {
  if (!element || isFullscreen()) return;
  const el = element as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
  } catch {
    /* browser may block without a fresh gesture */
  }
}

async function exitFullscreenSafe() {
  if (!isFullscreen()) return;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  };
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    else if (doc.msExitFullscreen) await doc.msExitFullscreen();
  } catch {
    /* ignore */
  }
}

function questionSection(q: AssessmentQuestion | undefined, fallback: string) {
  return (q?.section || '').trim() || fallback;
}

export function CbtAttemptRunner({
  title,
  studentName,
  questions,
  sections = [],
  durationMinutes,
  initialRemainingSeconds,
  storageKey,
  submitting,
  onSubmit,
  lockFullscreen = false,
  fullscreenExitCount = 0,
  maxFullscreenExits = 3,
  onFullscreenExit,
  cameraStream = null,
  onCameraStream,
  assignmentId,
}: {
  title: string;
  studentName?: string;
  questions: AssessmentQuestion[];
  sections?: string[];
  durationMinutes: number;
  initialRemainingSeconds: number | null;
  storageKey: string;
  submitting: boolean;
  onSubmit: (
    answers: { questionId: string; selectedOptionIds: string[]; textAnswer: string }[],
    submitReason: 'manual' | 'timer' | 'fullscreen_exits'
  ) => Promise<void>;
  lockFullscreen?: boolean;
  fullscreenExitCount?: number;
  maxFullscreenExits?: number;
  onFullscreenExit?: () => Promise<{ fullscreenExitCount?: number; forceSubmit?: boolean } | void>;
  cameraStream?: MediaStream | null;
  onCameraStream?: (stream: MediaStream) => void;
  assignmentId?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [liveCamera, setLiveCamera] = useState<MediaStream | null>(cameraStream);
  const [cameraLive, setCameraLive] = useState(Boolean(cameraStream?.getVideoTracks()[0]));
  const submittedRef = useRef(false);
  const exitHandlingRef = useRef(false);
  const onExitRef = useRef(onFullscreenExit);
  onExitRef.current = onFullscreenExit;
  const handleSubmitRef = useRef<(reason: 'manual' | 'timer' | 'fullscreen_exits') => void>(() => {});
  const stored = useMemo(() => readStored(storageKey), [storageKey]);

  const [answers, setAnswers] = useState<Record<string, CbtAnswerState>>(stored.answers);
  const [marked, setMarked] = useState<Record<string, boolean>>(stored.marked);
  const [visited, setVisited] = useState<Record<string, boolean>>(() => {
    const next = { ...stored.visited };
    const first = questions[stored.currentIndex]?.id || questions[0]?.id;
    if (first) next[first] = true;
    return next;
  });
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(stored.currentIndex, 0), Math.max(questions.length - 1, 0))
  );
  const [remaining, setRemaining] = useState(
    initialRemainingSeconds == null ? null : Math.max(0, initialRemainingSeconds)
  );
  useEffect(() => {
    if (remaining != null || initialRemainingSeconds == null) return;
    setRemaining(Math.max(0, initialRemainingSeconds));
  }, [initialRemainingSeconds, remaining]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  const [exitCount, setExitCount] = useState(fullscreenExitCount);
  const [needsFullscreenGesture, setNeedsFullscreenGesture] = useState(false);
  const exitsRemaining = Math.max(0, maxFullscreenExits - exitCount);

  const question = questions[currentIndex];
  const qid = question?.id || '';
  const answer = answers[qid] || { selectedOptionIds: [], textAnswer: '' };

  const goTo = useCallback(
    (index: number) => {
      const nextIndex = Math.min(Math.max(index, 0), questions.length - 1);
      const nextQ = questions[nextIndex];
      setCurrentIndex(nextIndex);
      if (nextQ?.id) setVisited((prev) => ({ ...prev, [nextQ.id!]: true }));
    },
    [questions]
  );

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

  const handleSubmit = useCallback(
    (reason: 'manual' | 'timer' | 'fullscreen_exits') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      Promise.resolve(onSubmit(buildPayload(), reason)).catch(() => {
        submittedRef.current = false;
      });
    },
    [buildPayload, onSubmit]
  );
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    setLiveCamera(cameraStream);
  }, [cameraStream]);

  useEffect(() => {
    const video = cameraRef.current;
    const stream = liveCamera;
    if (!video || !stream) return undefined;
    video.srcObject = stream;
    video.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    if (!track) {
      setCameraLive(false);
      return undefined;
    }
    const sync = () => setCameraLive(track.readyState === 'live' && track.enabled);
    sync();
    track.addEventListener('ended', sync);
    track.addEventListener('mute', sync);
    track.addEventListener('unmute', sync);
    return () => {
      track.removeEventListener('ended', sync);
      track.removeEventListener('mute', sync);
      track.removeEventListener('unmute', sync);
    };
  }, [liveCamera]);

  useEffect(() => {
    if (!assignmentId || !liveCamera || !cameraLive) return undefined;
    const video = cameraRef.current;
    if (!video) return undefined;
    const sample = document.createElement('canvas');
    const shot = document.createElement('canvas');
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    const shotCtx = shot.getContext('2d');
    if (!sampleCtx || !shotCtx) return undefined;
    const started = Date.now();
    let prev: Uint8ClampedArray | null = null;
    let lastSent = 0;
    let sentFirst = false;
    let sending = false;

    const timer = window.setInterval(() => {
      if (sending || video.readyState < 2 || video.videoWidth === 0) return;
      sample.width = 48;
      sample.height = 36;
      sampleCtx.drawImage(video, 0, 0, 48, 36);
      const frame = sampleCtx.getImageData(0, 0, 48, 36).data;
      let diff = 0;
      if (prev) {
        let changed = 0;
        let samples = 0;
        for (let i = 0; i < frame.length; i += 16) {
          samples += 1;
          const delta =
            Math.abs(frame[i] - prev[i]) +
            Math.abs(frame[i + 1] - prev[i + 1]) +
            Math.abs(frame[i + 2] - prev[i + 2]);
          if (delta > 48) changed += 1;
        }
        diff = samples ? changed / samples : 0;
      }
      const moved = diff > 0.18;
      const wantFirst = !sentFirst && Date.now() - started > 2000;
      prev = new Uint8ClampedArray(frame);
      if (!wantFirst && !moved) return;
      if (Date.now() - lastSent < 12000) return;
      const width = 320;
      const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
      shot.width = width;
      shot.height = height;
      shotCtx.drawImage(video, 0, 0, width, height);
      const image = shot.toDataURL('image/jpeg', 0.55);
      sending = true;
      lastSent = Date.now();
      sentFirst = true;
      uploadProctorCapture(assignmentId, image)
        .catch(() => {})
        .finally(() => {
          sending = false;
        });
    }, 800);

    return () => window.clearInterval(timer);
  }, [assignmentId, liveCamera, cameraLive]);

  useEffect(() => {
    if (!lockFullscreen) return undefined;
    const el = rootRef.current;
    requestFullscreenSafe(el).then(() => {
      if (!isFullscreen()) setNeedsFullscreenGesture(true);
    });

    function onFsChange() {
      if (isFullscreen()) {
        setNeedsFullscreenGesture(false);
        return;
      }
      if (submittedRef.current || exitHandlingRef.current) return;
      exitHandlingRef.current = true;
      Promise.resolve(onExitRef.current?.())
        .then((data) => {
          const nextCount = data?.fullscreenExitCount ?? exitCount + 1;
          setExitCount(nextCount);
          if (data?.forceSubmit || nextCount >= maxFullscreenExits) {
            handleSubmitRef.current('fullscreen_exits');
            return;
          }
          setNeedsFullscreenGesture(true);
        })
        .catch(() => {
          setNeedsFullscreenGesture(true);
        })
        .finally(() => {
          exitHandlingRef.current = false;
        });
    }

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      exitFullscreenSafe();
    };
    // Mount once for the attempt. Exit handler is read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockFullscreen]);

  useEffect(() => {
    if (remaining == null || remaining <= 0) return undefined;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev == null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining == null]); // eslint-disable-line react-hooks/exhaustive-deps -- start once when timed

  useEffect(() => {
    if (remaining === 0) handleSubmit('timer');
  }, [remaining, handleSubmit]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, marked, visited, currentIndex })
      );
    } catch {
      /* ignore */
    }
  }, [answers, marked, visited, currentIndex, storageKey]);

  const setAnswer = (next: CbtAnswerState) => {
    if (!qid) return;
    setAnswers((prev) => ({ ...prev, [qid]: next }));
  };

  const clearResponse = () => setAnswer({ selectedOptionIds: [], textAnswer: '' });

  const totalSeconds =
    durationMinutes > 0
      ? durationMinutes * 60
      : initialRemainingSeconds != null
        ? initialRemainingSeconds
        : 0;
  const elapsedSeconds =
    remaining == null || totalSeconds <= 0 ? totalSeconds : Math.max(0, totalSeconds - remaining);
  const submitUnlockAt = totalSeconds > 0 ? Math.ceil(totalSeconds * 0.2) : 0;
  const canSubmit = totalSeconds <= 0 || elapsedSeconds >= submitUnlockAt;
  const secondsUntilUnlock = Math.max(0, submitUnlockAt - elapsedSeconds);

  const isLast = currentIndex >= questions.length - 1;
  const isFirst = currentIndex <= 0;

  const confirmSubmit = () => {
    if (!canSubmit || submitting) return;
    setConfirmOpen(true);
  };

  const lowTime = remaining != null && remaining > 0 && remaining <= 60;
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id || ''])).length;

  const sectionNames = useMemo(() => {
    const named = sections.map((s) => s.trim()).filter(Boolean);
    const base = named.length ? [...named] : [];
    for (const q of questions) {
      const name = (q.section || '').trim() || base[0] || 'Section A';
      if (!base.includes(name)) base.push(name);
    }
    return base.length ? base : ['Section A'];
  }, [sections, questions]);

  const fallbackSection = sectionNames[0] || 'Section A';
  const groupedSections = useMemo(
    () =>
      sectionNames.map((name) => ({
        name,
        items: questions
          .map((q, index) => ({ q, index }))
          .filter(({ q }) => questionSection(q, fallbackSection) === name),
      })),
    [sectionNames, questions, fallbackSection]
  );
  const activeSection = questionSection(question, fallbackSection);

  return (
    <div ref={rootRef} className="fixed inset-0 z-[80] flex flex-col bg-[linear-gradient(180deg,#f7f8fb_0%,#eef2f7_100%)] text-slate-900">
      {lockFullscreen && liveCamera && !cameraLive ? (
        <div className="absolute inset-0 z-[95] flex items-center justify-center bg-slate-900/80 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Turn the camera back on</h2>
            <p className="mt-2 text-sm text-slate-600">
              Video stopped. Allow the camera again to keep working on the exam.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-bold text-white"
              onClick={() => {
                navigator.mediaDevices
                  ?.getUserMedia({ audio: false, video: { facingMode: 'user' } })
                  .then((stream) => {
                    liveCamera.getTracks().forEach((track) => track.stop());
                    setLiveCamera(stream);
                    onCameraStream?.(stream);
                  })
                  .catch(() => setCameraLive(false));
              }}
            >
              Enable camera
            </button>
          </div>
        </div>
      ) : null}
      {lockFullscreen && needsFullscreenGesture ? (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-6">
          <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Continue in fullscreen</h2>
            <p className="mt-2 text-sm text-slate-600">
              Leaving fullscreen counts as an exit. After {maxFullscreenExits} exits the exam submits
              automatically.
              {exitsRemaining < maxFullscreenExits
                ? ` You have ${exitsRemaining} exit${exitsRemaining === 1 ? '' : 's'} left.`
                : ''}
            </p>
            <button
              type="button"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-bold text-white"
              onClick={() => requestFullscreenSafe(rootRef.current)}
            >
              Enter fullscreen
            </button>
          </div>
        </div>
      ) : null}
      <header className="shrink-0 border-b border-slate-800/40 bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</p>
            <p className="truncate text-xs text-white/60">
              {studentName || 'Student'}
              <span className="hidden sm:inline"> · {lockFullscreen ? 'Online exam' : 'Assessment'}</span>
              <span>
                {' '}
                · {answeredCount}/{questions.length} answered
              </span>
            </p>
          </div>
          {remaining != null ? (
            <span
              className={clsx(
                'shrink-0 rounded-full px-3 py-1.5 font-mono text-sm font-semibold tabular-nums',
                lowTime ? 'animate-pulse bg-rose-500 text-white' : 'bg-white/10 text-white'
              )}
            >
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">Untimed</span>
          )}
          {lockFullscreen && liveCamera ? (
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black ring-2 ring-white/30">
              <video
                ref={cameraRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full -scale-x-100 object-cover"
              />
            </span>
          ) : null}
        </div>
        <div className="h-0.5 bg-white/10">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
          {lockFullscreen ? (
            <span className="shrink-0 rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
              {exitsRemaining} exit{exitsRemaining === 1 ? '' : 's'} left
            </span>
          ) : null}
          {groupedSections.map((group) => {
            const isActive = group.name === activeSection;
            const count = group.items.length;
            const done = group.items.filter(({ q }) => isAnswered(q, answers[q.id || ''])).length;
            return (
              <button
                key={group.name}
                type="button"
                disabled={count === 0}
                onClick={() => {
                  const first = group.items[0];
                  if (first) goTo(first.index);
                }}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition',
                  isActive
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-white/80 hover:bg-white/15 disabled:cursor-default disabled:opacity-50'
                )}
              >
                {group.name}
                <span className={clsx('ml-1.5 tabular-nums', isActive ? 'text-slate-500' : 'text-white/50')}>
                  {done}/{count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {lowTime ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          Less than a minute left. Answers submit automatically when the timer ends.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
            <article className="flex w-full flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-500">
                  Question {currentIndex + 1} of {questions.length}
                  <span className="text-slate-300"> · </span>
                  {activeSection}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
                  {typeLabel(question.type)} · {question.points} mark{question.points === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-4 text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
                {question.prompt}
              </p>

            {question.type === 'short_answer' ? (
              <div className="mt-6 max-w-md">
                <input
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="1–2 words"
                  maxLength={100}
                  value={answer.textAnswer}
                  onChange={(e) => setAnswer({ ...answer, textAnswer: e.target.value })}
                />
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3">
                {question.options.map((opt, displayIndex) => {
                  const id = opt.id || '';
                  const isSelected =
                    question.type === 'single_select'
                      ? answer.selectedOptionIds[0] === id
                      : answer.selectedOptionIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={clsx(
                        'flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type={question.type === 'multi_select' ? 'checkbox' : 'radio'}
                        name={`question-${qid}`}
                        checked={isSelected}
                        onChange={() => {
                          if (question.type === 'single_select') {
                            setAnswer({ ...answer, selectedOptionIds: id ? [id] : [] });
                          } else {
                            const next = isSelected
                              ? answer.selectedOptionIds.filter((x) => x !== id)
                              : [...answer.selectedOptionIds, id];
                            setAnswer({ ...answer, selectedOptionIds: next });
                          }
                        }}
                        className="sr-only"
                      />
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {optionLabel(displayIndex)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
            </article>
          </div>

          <div className="border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-6">
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => goTo(currentIndex - 1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => goTo(currentIndex + 1)}
                className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => {
                  if (qid) setMarked((prev) => ({ ...prev, [qid]: true }));
                  if (!isLast) goTo(currentIndex + 1);
                }}
                className="rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-semibold text-amber-900"
              >
                Review
              </button>
              <button
                type="button"
                onClick={clearResponse}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen((open) => !open)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                {paletteOpen ? 'Hide list' : 'Questions'}
              </button>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={confirmSubmit}
                className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => goTo(currentIndex - 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  if (qid) setMarked((prev) => ({ ...prev, [qid]: true }));
                  if (!isLast) goTo(currentIndex + 1);
                }}
                className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-200"
              >
                Review &amp; next
              </button>
              <button
                type="button"
                onClick={clearResponse}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => goTo(currentIndex + 1)}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  Next
                </button>
                {paletteOpen ? null : (
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={confirmSubmit}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                )}
              </div>
            </div>
            {!paletteOpen && !canSubmit && remaining != null ? (
              <p className="mt-2 text-center text-[11px] leading-snug text-slate-500 md:text-right">
                Submit unlocks after 20% of the timer ({formatClock(secondsUntilUnlock)})
              </p>
            ) : null}
          </div>
        </main>

        {paletteOpen ? (
        <>
        <button
          type="button"
          aria-label="Close question palette"
          className="fixed inset-0 z-[84] bg-slate-900/40 md:hidden"
          onClick={() => setPaletteOpen(false)}
        />
        <aside className="z-[85] flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[min(70vh,32rem)] max-md:w-full max-md:rounded-t-3xl max-md:border-l-0 max-md:shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Questions</p>
              <p className="text-xs text-slate-400">
                {answeredCount} of {questions.length} answered
              </p>
            </div>
            <button
              type="button"
              aria-label="Close question palette"
              onClick={() => setPaletteOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-y border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Answered</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Seen</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Review</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> New</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {groupedSections.map((group) => (
              <div key={group.name} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs font-semibold text-slate-500">{group.name}</p>
                {group.items.length ? (
                  <div className="grid grid-cols-5 gap-2">
                    {group.items.map(({ q, index }, localIndex) => {
                      const id = q.id || '';
                      const answered = isAnswered(q, answers[id]);
                      const isMarked = !!marked[id];
                      const isVisited = !!visited[id];
                      const isCurrent = index === currentIndex;
                      return (
                        <button
                          key={id || index}
                          type="button"
                          onClick={() => goTo(index)}
                          className={clsx(
                            'flex h-10 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition',
                            paletteTone({ answered, marked: isMarked, visited: isVisited }),
                            isCurrent && 'ring-2 ring-slate-900 ring-offset-2'
                          )}
                        >
                          {localIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">No questions</p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 px-3 py-3">
            {!canSubmit && remaining != null ? (
              <p className="mb-1.5 text-[11px] leading-snug text-slate-500">
                Submit unlocks after 20% of the timer ({formatClock(secondsUntilUnlock)})
              </p>
            ) : null}
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={confirmSubmit}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>
          </div>
        </aside>
        </>
        ) : (
          <button
            type="button"
            aria-label="Open question palette"
            title="Question palette"
            onClick={() => setPaletteOpen(true)}
            className="hidden w-9 shrink-0 items-center justify-center border-l border-slate-200 bg-white text-lg text-slate-400 hover:bg-slate-50 hover:text-slate-800 md:flex"
          >
            ‹
          </button>
        )}
      </div>
      <SubmitConfirmDialog
        open={confirmOpen}
        answered={answeredCount}
        total={questions.length}
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          handleSubmit('manual');
        }}
      />
    </div>
  );
}
