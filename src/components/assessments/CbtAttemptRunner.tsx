import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { uploadProctorCapture, type AssessmentQuestion } from '@/hooks/api/useAssessments';

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
  const [paletteOpen, setPaletteOpen] = useState(true);
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
    if (!canSubmit) return;
    const unanswered = questions.filter((q) => !isAnswered(q, answers[q.id || ''])).length;
    if (unanswered > 0) {
      const ok = window.confirm(
        `You have not answered ${unanswered} question${unanswered === 1 ? '' : 's'}. Submit anyway?`
      );
      if (!ok) return;
    }
    handleSubmit('manual');
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
    <div ref={rootRef} className="fixed inset-0 z-[80] flex flex-col bg-[#f4f6f8] text-slate-900">
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
      <header className="border-b border-slate-300 bg-[#1e3a5f] text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-white/70">{lockFullscreen ? 'Online exam' : 'Assessment'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {remaining != null ? (
              <span
                className={clsx(
                  'rounded-md px-3 py-1.5 font-mono font-bold tabular-nums',
                  lowTime ? 'animate-pulse bg-red-500' : 'bg-white/15'
                )}
              >
                Time Left :- {formatClock(remaining)}
              </span>
            ) : (
              <span className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold">Untimed</span>
            )}
            <span className="font-medium">{studentName || 'Student'}</span>
            {lockFullscreen && liveCamera ? (
              <span className="relative h-10 w-14 overflow-hidden rounded-md bg-black ring-1 ring-white/40">
                <video
                  ref={cameraRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
              </span>
            ) : null}
            {lockFullscreen ? (
              <span className="rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-slate-900">
                FS exits left: {exitsRemaining}/{maxFullscreenExits}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-2.5">
          {groupedSections.map((group) => {
            const isActive = group.name === activeSection;
            const count = group.items.length;
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
                  'rounded px-3 py-1 text-xs font-bold uppercase tracking-wide',
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/15 disabled:cursor-default disabled:opacity-50'
                )}
              >
                {group.name} ({count})
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
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm">
            <span className="font-bold text-[#1e3a5f]">Qus. No {currentIndex + 1}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span className="font-semibold">{activeSection}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span className="font-semibold">{typeLabel(question.type)}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span>
              Marks : {question.points}
              {question.type === 'multi_select' ? ' (select all that apply)' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <p className="text-base font-semibold leading-relaxed text-slate-900">{question.prompt}</p>

            {question.type === 'short_answer' ? (
              <div className="mt-5 max-w-md">
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  placeholder="1–2 words"
                  maxLength={100}
                  value={answer.textAnswer}
                  onChange={(e) => setAnswer({ ...answer, textAnswer: e.target.value })}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
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
                        'flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition',
                        isSelected
                          ? 'border-[#1e3a5f] bg-[#e8eef6]'
                          : 'border-slate-300 bg-slate-100 hover:border-slate-400'
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
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1e3a5f]"
                      />
                      <span className="w-5 shrink-0 pt-0.5 text-sm font-bold text-slate-500">
                        {optionLabel(displayIndex)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-relaxed">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-300 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => goTo(currentIndex - 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  if (qid) setMarked((prev) => ({ ...prev, [qid]: true }));
                  if (!isLast) goTo(currentIndex + 1);
                }}
                className="rounded-md bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-900 hover:bg-amber-400"
              >
                Mark for review &amp; next
              </button>
              <button
                type="button"
                onClick={clearResponse}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700"
              >
                Clear response
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => goTo(currentIndex + 1)}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Save &amp; next
                </button>
                {paletteOpen ? null : (
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={confirmSubmit}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-800"
                  >
                    {submitting ? 'Submitting…' : 'Submit test'}
                  </button>
                )}
              </div>
            </div>
            {!paletteOpen && !canSubmit && remaining != null ? (
              <p className="mt-1 text-right text-[11px] text-slate-500">
                Submit unlocks after 20% of the timer ({formatClock(secondsUntilUnlock)})
              </p>
            ) : null}
          </div>
        </main>

        {paletteOpen ? (
        <aside className="flex min-h-0 w-72 shrink-0 flex-col overflow-hidden border-l border-slate-300 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1e3a5f]">Question palette</p>
            <button
              type="button"
              aria-label="Close question palette"
              onClick={() => setPaletteOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              ×
            </button>
          </div>
          <div className="space-y-1.5 border-b border-slate-200 px-4 py-3 text-[11px] text-slate-600">
            <p className="font-semibold uppercase tracking-wide text-slate-800">Legend</p>
            <p>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Answered
            </p>
            <p>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Not answered
            </p>
            <p>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-violet-500" /> Marked
            </p>
            <p>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" /> Not visited
            </p>
            <p>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-violet-600 ring-2 ring-violet-300" />{' '}
              Answered &amp; marked
            </p>
            <p className="pt-1 text-xs text-slate-500">
              {answeredCount}/{questions.length} answered
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {groupedSections.map((group) => (
              <div key={group.name} className="mb-4 last:mb-0">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.name}</p>
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
                            'flex h-9 items-center justify-center text-xs font-bold tabular-nums',
                            isMarked ? 'rounded-full' : 'rounded',
                            paletteTone({ answered, marked: isMarked, visited: isVisited }),
                            isCurrent && 'outline outline-2 outline-offset-1 outline-[#1e3a5f]'
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
              className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-800"
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>
          </div>
        </aside>
        ) : (
          <button
            type="button"
            aria-label="Open question palette"
            title="Question palette"
            onClick={() => setPaletteOpen(true)}
            className="flex w-8 shrink-0 items-center justify-center border-l border-slate-300 bg-white text-lg text-slate-500 hover:bg-slate-50 hover:text-[#1e3a5f]"
          >
            ‹
          </button>
        )}
      </div>
    </div>
  );
}
