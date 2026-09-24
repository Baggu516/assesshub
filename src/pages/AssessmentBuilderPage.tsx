import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
  Toggle,
} from '@/components/ui';
import {
  useAssessmentQuery,
  useAssessmentMutations,
  useAssessmentAssigneesQuery,
  useAssessmentAssignmentSummaryQuery,
  type AssessmentPayload,
  type AssessmentQuestion,
  type ExamKind,
  type QuestionType,
} from '@/hooks/api/useAssessments';
import { useClassesQuery, type ClassMemberRow } from '@/hooks/api/useClasses';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import type { AiAssessmentDraft } from '@/components/assessments/CreateWithAiModal';

const selectClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Students' },
  { id: 3, label: 'Timing' },
  { id: 4, label: 'Launch' },
] as const;

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_select: 'Single choice',
  multi_select: 'Multi-select',
  short_answer: 'Short answer',
};

function toDatetimeLocalValue(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStartLocal() {
  return toDatetimeLocalValue(new Date());
}

function defaultEndLocal() {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(d);
}

function emptyQuestion(type: QuestionType, order: number, section = 'Section A'): AssessmentQuestion {
  if (type === 'short_answer') {
    return {
      type,
      prompt: '',
      points: 1,
      order,
      section,
      explanation: '',
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
    section,
    explanation: '',
    options: [
      { text: '', isCorrect: type === 'single_select' },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done && 'bg-brand-600 text-white',
                  active && 'bg-brand-600 text-white ring-4 ring-brand-500/15',
                  !done && !active && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.id
                )}
              </span>
              <span
                className={clsx(
                  'truncate text-sm font-medium',
                  active || done ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={clsx(
                  'h-px min-w-[1rem] flex-1',
                  step > s.id ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
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
  sections,
  onChange,
  onRemove,
  onMove,
  canRemove,
  canMoveUp,
  canMoveDown,
}: {
  question: AssessmentQuestion;
  index: number;
  sections: string[];
  onChange: (q: AssessmentQuestion) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const changeType = (type: QuestionType) => {
    if (type === question.type) return;
    const base = emptyQuestion(type, question.order, question.section || sections[0] || 'Section A');
    onChange({
      ...base,
      prompt: question.prompt,
      points: question.points,
      explanation: question.explanation || '',
      section: question.section || sections[0] || 'Section A',
    });
  };

  const optionLetter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
            Q{index + 1}
          </span>
          <Badge tone="brand">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          <span className="text-xs tabular-nums text-slate-500">
            {question.points} mark{question.points !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
            title="Move up"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
            title="Move down"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Delete"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <FormField label="Question" htmlFor={`q-prompt-${index}`} required>
          <Textarea
            id={`q-prompt-${index}`}
            placeholder="Enter the question…"
            className="min-h-[76px] rounded-xl"
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-slate-400">Supports LaTeX for formulas.</p>
        </FormField>

        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Answer type" htmlFor={`q-type-${index}`}>
            <select
              id={`q-type-${index}`}
              className={selectClass}
              value={question.type}
              onChange={(e) => changeType(e.target.value as QuestionType)}
            >
              <option value="single_select">Single choice (one answer)</option>
              <option value="multi_select">Multi-select (more than one)</option>
              <option value="short_answer">Short answer (1–2 words)</option>
            </select>
          </FormField>
          <FormField label="Section" htmlFor={`q-section-${index}`}>
            <select
              id={`q-section-${index}`}
              className={selectClass}
              value={question.section || sections[0] || 'Section A'}
              onChange={(e) => onChange({ ...question, section: e.target.value })}
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Marks" htmlFor={`q-marks-${index}`}>
            <Input
              id={`q-marks-${index}`}
              type="number"
              min={0}
              max={100}
              value={question.points}
              onChange={(e) => onChange({ ...question, points: Number(e.target.value) || 0 })}
            />
          </FormField>
        </div>

        {question.type !== 'short_answer' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Options</p>
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
                + Add option
              </Button>
            </div>
            <div className="space-y-2">
              {question.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <CorrectMark
                    kind={question.type === 'single_select' ? 'radio' : 'checkbox'}
                    checked={!!opt.isCorrect}
                    onChange={() => {
                      if (question.type === 'single_select') {
                        onChange({
                          ...question,
                          options: question.options.map((o, i) => ({
                            ...o,
                            isCorrect: i === oi,
                          })),
                        });
                      } else {
                        onChange({
                          ...question,
                          options: question.options.map((o, i) =>
                            i === oi ? { ...o, isCorrect: !o.isCorrect } : o
                          ),
                        });
                      }
                    }}
                  />
                  <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">{optionLetter(oi)}</span>
                  <Input
                    placeholder={`Option ${optionLetter(oi)}`}
                    value={opt.text}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        options: question.options.map((o, i) =>
                          i === oi ? { ...o, text: e.target.value } : o
                        ),
                      })
                    }
                  />
                  {question.options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...question,
                          options: question.options.filter((_, i) => i !== oi),
                        })
                      }
                      className="rounded-md p-1.5 text-slate-400 hover:text-rose-500"
                      title="Remove option"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {!question.options.some((o) => o.isCorrect && o.text.trim()) ? (
              <p className="text-xs text-rose-600">Mark at least one option as correct.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Accepted answers</p>
            {(question.acceptedAnswers || ['']).map((ans, ai) => (
              <Input
                key={ai}
                placeholder="Accepted answer"
                value={ans}
                onChange={(e) => {
                  const next = [...(question.acceptedAnswers || [''])];
                  next[ai] = e.target.value;
                  onChange({ ...question, acceptedAnswers: next });
                }}
              />
            ))}
            <div className="flex flex-wrap items-center gap-3">
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

        <FormField label="Explanation" htmlFor={`q-expl-${index}`} hint="Optional — shown on the result card.">
          <Textarea
            id={`q-expl-${index}`}
            placeholder="Explain the correct answer…"
            className="min-h-[56px] rounded-xl"
            value={question.explanation || ''}
            onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}

function PickStudentsModal({
  open,
  onClose,
  items,
  alreadySelected,
  onImport,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  items: ClassMemberRow[];
  alreadySelected: Set<string>;
  onImport: (ids: string[]) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setPicked(new Set());
    }
  }, [open]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      if (alreadySelected.has(m.id)) return false;
      if (!q) return true;
      return m.label.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [items, alreadySelected, query]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add students"
      description="Select students who should receive this assessment."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={picked.size === 0}
            onClick={() => {
              onImport([...picked]);
              onClose();
            }}
          >
            Add {picked.size || ''} selected
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        {loading ? (
          <Skeleton className="h-40" />
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {items.length === 0 ? 'No students available.' : 'Everyone matching is already added.'}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="w-10 px-3 py-2 font-medium" />
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {available.map((m) => {
                  const checked = picked.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      onClick={() => toggle(m.id)}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={checked} readOnly className="rounded" />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{m.label}</td>
                      <td className="px-3 py-2 text-slate-500">{m.email}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AssessmentBuilderPage({ kind = 'assessment' }: { kind?: ExamKind }) {
  const online = kind === 'online_exam';
  const base = online ? '/online-exams' : '/assessments';
  const noun = online ? 'online exam' : 'assessment';
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const isEdit = Boolean(assessmentId);
  const navigate = useNavigate();
  const location = useLocation();
  const aiDraft = (location.state as { aiDraft?: AiAssessmentDraft } | null)?.aiDraft;

  const { data: existing, isLoading, isError } = useAssessmentQuery(assessmentId);
  const { data: years = [] } = useAcademicYearsQuery();
  const currentYear = useMemo(() => years.find((y) => y.isCurrent) || years[0] || null, [years]);
  const { data: classes = [], isLoading: classesLoading } = useClassesQuery(
    true,
    currentYear?.id || null
  );
  const { data: assignees = [], isLoading: assigneesLoading } = useAssessmentAssigneesQuery();
  const { create, update, publish, assign } = useAssessmentMutations();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(() => aiDraft?.title || '');
  const [description, setDescription] = useState(() => aiDraft?.description || '');
  const [sections, setSections] = useState<string[]>(['Section A']);
  const [negativeMarkPerWrong, setNegativeMarkPerWrong] = useState(0);
  const [allowPartialCredit, setAllowPartialCredit] = useState(true);
  const [showAnswersAfterSubmit, setShowAnswersAfterSubmit] = useState(true);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(() =>
    aiDraft?.questions?.length
      ? aiDraft.questions.map((q, i) => ({
          ...q,
          order: i,
          section: 'Section A',
          explanation: '',
        }))
      : [emptyQuestion('single_select', 0)]
  );

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [pickStudentsOpen, setPickStudentsOpen] = useState(false);

  const [startAt, setStartAt] = useState(defaultStartLocal);
  const [endAt, setEndAt] = useState(defaultEndLocal);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [cameraMonitor, setCameraMonitor] = useState(false);

  const [launchStatus, setLaunchStatus] = useState<'draft' | 'published'>('draft');
  const [hydrated, setHydrated] = useState(!isEdit);
  const [fromAi] = useState(() => Boolean(aiDraft?.questions?.length));
  const [summaryHydrated, setSummaryHydrated] = useState(false);

  const { data: assignSummary } = useAssessmentAssignmentSummaryQuery(
    assessmentId,
    currentYear?.id,
    isEdit && hydrated
  );

  useEffect(() => {
    if (!aiDraft || isEdit) return;
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit || !existing) return;
    if (existing.status !== 'draft') {
      toast.error('Only draft assessments can be edited');
      navigate(base, { replace: true });
      return;
    }
    setTitle(existing.title);
    setDescription(existing.description || '');
    setDurationMinutes(existing.durationMinutes ?? 60);
    setCameraMonitor(existing.cameraMonitor === true);
    setNegativeMarkPerWrong(existing.negativeMarkPerWrong ?? 0);
    setAllowPartialCredit(existing.allowPartialCredit !== false);
    setShowAnswersAfterSubmit(existing.showAnswersAfterSubmit !== false);
    setSections(
      existing.sections?.length ? existing.sections : ['Section A']
    );
    setStartAt(toDatetimeLocalValue(existing.startAt) || defaultStartLocal());
    setEndAt(toDatetimeLocalValue(existing.endAt) || defaultEndLocal());
    setLaunchStatus('draft');
    setQuestions(
      existing.questions?.length
        ? existing.questions.map((q, i) => ({
            ...q,
            order: i,
            section: q.section || existing.sections?.[0] || 'Section A',
            explanation: q.explanation || '',
          }))
        : [emptyQuestion('single_select', 0)]
    );
    setHydrated(true);
  }, [isEdit, existing, navigate]);

  useEffect(() => {
    if (!isEdit || !assignSummary || summaryHydrated) return;
    if (assignSummary.assignedStudentIds?.length) {
      setStudentIds(assignSummary.assignedStudentIds);
    }
    setSummaryHydrated(true);
  }, [isEdit, assignSummary, summaryHydrated]);

  const studentById = useMemo(() => {
    const map = new Map<string, ClassMemberRow>();
    for (const a of assignees) {
      map.set(a.id, { id: a.id, email: a.email, label: a.label });
    }
    for (const c of classes) {
      for (const s of c.students || []) map.set(s.id, s);
    }
    return map;
  }, [assignees, classes]);

  const classStudentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of classes) {
      if (!selectedClassIds.includes(c.id)) continue;
      for (const s of c.students || []) ids.add(s.id);
    }
    return ids;
  }, [classes, selectedClassIds]);

  const effectiveStudentIds = useMemo(() => {
    const ids = new Set([...studentIds, ...classStudentIds]);
    return [...ids];
  }, [studentIds, classStudentIds]);

  const selectedStudents = useMemo(
    () =>
      studentIds
        .map((id) => studentById.get(id))
        .filter(Boolean) as ClassMemberRow[],
    [studentIds, studentById]
  );

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions]
  );

  const canContinueDetails = useMemo(() => {
    if (!title.trim() || !questions.length || !sections.some((s) => s.trim())) return false;
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
  }, [title, questions, sections]);

  const canContinueTiming = Boolean(startAt && endAt && durationMinutes >= 0);

  const saving =
    create.isPending || update.isPending || publish.isPending || assign.isPending;

  const buildPayload = (): AssessmentPayload => {
    const cleanSections = sections.map((s) => s.trim()).filter(Boolean);
    const fallback = cleanSections[0] || 'Section A';
    return {
      kind,
      title: title.trim(),
      description: description.trim(),
      durationMinutes: Math.min(300, Math.max(0, Number(durationMinutes) || 0)),
      startAt: startAt ? new Date(startAt).toISOString() : null,
      endAt: endAt ? new Date(endAt).toISOString() : null,
      negativeMarkPerWrong: Number(negativeMarkPerWrong) || 0,
      allowPartialCredit,
      showAnswersAfterSubmit,
      cameraMonitor: kind === 'online_exam' && cameraMonitor,
      sections: cleanSections.length ? cleanSections : ['Section A'],
      questions: questions.map((q, i) => ({
        ...q,
        order: i,
        section: (q.section || fallback).trim() || fallback,
        explanation: (q.explanation || '').trim(),
        options: q.options.map(({ text, isCorrect }) => ({
          text: text.trim(),
          isCorrect: !!isCorrect,
        })),
        acceptedAnswers: (q.acceptedAnswers || []).map((a) => a.trim()).filter(Boolean),
      })),
    };
  };

  const handleFinish = async () => {
    if (!canContinueDetails || !canContinueTiming || saving) return;
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      toast.error('Ending time must be after starting time');
      return;
    }

    try {
      const payload = buildPayload();
      let id = assessmentId;

      if (isEdit && assessmentId) {
        await update.mutateAsync({ id: assessmentId, ...payload });
      } else {
        const created = await create.mutateAsync(payload);
        id = created.id;
      }

      if (!id) throw new Error('Missing assessment id');

      if (launchStatus === 'published') {
        await publish.mutateAsync(id);
      }

      if (effectiveStudentIds.length > 0) {
        await assign.mutateAsync({
          id,
          studentIds: effectiveStudentIds,
          academicYearId: currentYear?.id,
          dueDate: endAt ? new Date(endAt).toISOString() : null,
        });
      }

      toast.success(
        launchStatus === 'published'
          ? 'Assessment launched'
          : isEdit
            ? 'Draft saved'
            : 'Draft created'
      );
      navigate(base);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save assessment');
    }
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addSection = () => {
    const next = `Section ${String.fromCharCode(65 + sections.length)}`;
    setSections((prev) => [...prev, next]);
  };

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isEdit && (isError || (!isLoading && !existing))) {
    return (
      <Card className="max-w-lg p-8 text-center text-sm text-slate-500">
        Assessment not found.{' '}
        <Link to={base} className="font-medium text-brand-600 hover:underline">
          Back to list
        </Link>
      </Card>
    );
  }

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        eyebrow={online ? 'Online exams' : 'Assessments'}
        title={
          isEdit
            ? `Edit ${noun}`
            : fromAi
              ? 'Review AI draft'
              : `New ${noun}`
        }
        description={
          online
            ? 'Students take this in fullscreen. Leaving fullscreen three times submits the exam.'
            : 'Students attempt this online. It does not use the exam fullscreen lock.'
        }
        actions={
          <Button variant="secondary" onClick={() => navigate(base)}>
            ← Back
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <Stepper step={step} />
      </Card>

      {step === 1 ? (
        <div className="space-y-5">
          <Card className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Details</h2>
              <p className="mt-0.5 text-sm text-slate-500">Title, instructions, sections, and scoring.</p>
            </div>
            <FormField label="Title" htmlFor="assessment-title" required>
              <Input
                id="assessment-title"
                placeholder="Example: Mid-term Assessment — Physics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField
              label="Instructions"
              htmlFor="assessment-description"
              hint="Optional notes shown to students before they start."
            >
              <Textarea
                id="assessment-description"
                placeholder="Brief context or instructions…"
                className="min-h-[72px] rounded-xl"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sections</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Students switch sections with tabs during the test.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addSection}>
                + Add section
              </Button>
            </div>
            <div className="space-y-2">
              {sections.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FormField label={i === 0 ? 'Section name' : `Section ${i + 1}`} className="flex-1">
                    <Input
                      value={name}
                      onChange={(e) => {
                        const next = [...sections];
                        const old = next[i];
                        next[i] = e.target.value;
                        setSections(next);
                        setQuestions((qs) =>
                          qs.map((q) =>
                            q.section === old ? { ...q, section: e.target.value } : q
                          )
                        );
                      }}
                    />
                  </FormField>
                  {sections.length > 1 ? (
                    <button
                      type="button"
                      className="mt-5 rounded-md p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => {
                        const removed = sections[i];
                        const next = sections.filter((_, idx) => idx !== i);
                        setSections(next);
                        setQuestions((qs) =>
                          qs.map((q) =>
                            q.section === removed
                              ? { ...q, section: next[0] || 'Section A' }
                              : q
                          )
                        );
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Scoring rules</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Negative marks per wrong answer"
                htmlFor="neg-marks"
                hint="0 means no negative marking. Skipped questions are never penalised."
              >
                <Input
                  id="neg-marks"
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  value={negativeMarkPerWrong}
                  onChange={(e) => setNegativeMarkPerWrong(Number(e.target.value) || 0)}
                />
              </FormField>
              <FormField
                label="Partial credit on multi-select"
                htmlFor="partial-credit"
                hint="Partial marks only when every picked option is correct."
              >
                <select
                  id="partial-credit"
                  className={selectClass}
                  value={allowPartialCredit ? 'true' : 'false'}
                  onChange={(e) => setAllowPartialCredit(e.target.value === 'true')}
                >
                  <option value="true">Give partial marks</option>
                  <option value="false">All or nothing</option>
                </select>
              </FormField>
              <FormField
                label="Answer key"
                htmlFor="answer-key"
                hint="Students see this only after you announce results. Their score is shown either way."
              >
                <select
                  id="answer-key"
                  className={selectClass}
                  value={showAnswersAfterSubmit ? 'true' : 'false'}
                  onChange={(e) => setShowAnswersAfterSubmit(e.target.value === 'true')}
                >
                  <option value="true">Show correct answers</option>
                  <option value="false">Hide correct answers</option>
                </select>
              </FormField>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Questions</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} total marks
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setQuestions((qs) => [
                    ...qs,
                    emptyQuestion('single_select', qs.length, sections[0] || 'Section A'),
                  ])
                }
              >
                + Add question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  sections={sections.filter((s) => s.trim())}
                  canRemove={questions.length > 1}
                  canMoveUp={i > 0}
                  canMoveDown={i < questions.length - 1}
                  onChange={(updated) =>
                    setQuestions((qs) => qs.map((item, idx) => (idx === i ? updated : item)))
                  }
                  onRemove={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                  onMove={(dir) => {
                    setQuestions((qs) => {
                      const next = [...qs];
                      const j = i + dir;
                      if (j < 0 || j >= next.length) return qs;
                      [next[i], next[j]] = [next[j], next[i]];
                      return next.map((item, idx) => ({ ...item, order: idx }));
                    });
                  }}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setQuestions((qs) => [
                  ...qs,
                  emptyQuestion('single_select', qs.length, sections[0] || 'Section A'),
                ])
              }
            >
              + Add question
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" disabled={!canContinueDetails} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Select students</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Choose classes and/or individual students. Visible to selected students when launched.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Classes</p>
              <span className="text-xs text-slate-400">{selectedClassIds.length} selected</span>
            </div>
            {classesLoading ? (
              <Skeleton className="h-24" />
            ) : classes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                No classes in the current year. You can still add students individually.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {classes.map((c) => {
                  const checked = selectedClassIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={clsx(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                        checked
                          ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-950/30'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded"
                        checked={checked}
                        onChange={() => toggleClass(c.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          {c.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Extra students
                </p>
                <p className="text-xs text-slate-500">
                  {selectedStudents.length} added · {effectiveStudentIds.length} total with classes
                </p>
              </div>
              <Button type="button" onClick={() => setPickStudentsOpen(true)}>
                Add students
              </Button>
            </div>

            {selectedStudents.length === 0 ? (
              <EmptyState
                title="No extra students"
                description="Optional — pick individuals who are not already covered by a selected class."
                className="rounded-xl border border-dashed border-slate-200 py-8 dark:border-slate-700"
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/80">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Email</th>
                      <th className="w-24 px-4 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedStudents.map((m) => (
                      <tr key={m.id} className="bg-white dark:bg-slate-950/40">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {m.label}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{m.email}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setStudentIds((prev) => prev.filter((x) => x !== m.id))
                            }
                            className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Timing</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              When students may start, and how long they get once they begin.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Starting date and time" htmlFor="start-at" required>
              <Input
                id="start-at"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </FormField>
            <FormField
              label="Ending date and time"
              htmlFor="end-at"
              required
              hint="After this, students can no longer start the assessment."
            >
              <Input
                id="end-at"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            label="Duration (minutes)"
            htmlFor="duration"
            required
            hint="Auto-submits when time runs out. Use 0 for untimed."
            className="max-w-xs"
          >
            <Input
              id="duration"
              type="number"
              min={0}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
            />
          </FormField>
          {online ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Camera monitor</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Students must turn the camera on before the exam starts. Leave this off to run the exam without a camera.
                </p>
              </div>
              <Toggle
                id="camera-monitor"
                checked={cameraMonitor}
                onChange={setCameraMonitor}
                aria-label="Camera monitor"
              />
            </div>
          ) : null}
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={!canContinueTiming} onClick={() => setStep(4)}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Launch</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Review and choose whether to keep as draft or publish now.
            </p>
          </div>

          <FormField
            label="Status"
            htmlFor="launch-status"
            hint="Students only see published assessments."
          >
            <select
              id="launch-status"
              className={selectClass}
              value={launchStatus}
              onChange={(e) => setLaunchStatus(e.target.value as 'draft' | 'published')}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </FormField>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-white">{title || 'Untitled'}</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>
                {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} marks ·{' '}
                {sections.filter((s) => s.trim()).length} section
                {sections.filter((s) => s.trim()).length !== 1 ? 's' : ''}
              </li>
              <li>
                {effectiveStudentIds.length} student{effectiveStudentIds.length !== 1 ? 's' : ''}
                {selectedClassIds.length
                  ? ` · ${selectedClassIds.length} class${selectedClassIds.length !== 1 ? 'es' : ''}`
                  : ''}
              </li>
              <li>
                {durationMinutes} min · {startAt ? new Date(startAt).toLocaleString() : '—'} →{' '}
                {endAt ? new Date(endAt).toLocaleString() : '—'}
                {online ? ` · Camera ${cameraMonitor ? 'on' : 'off'}` : ''}
              </li>
            </ul>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={saving || !canContinueDetails || !canContinueTiming}
              onClick={handleFinish}
            >
              {saving
                ? 'Saving…'
                : launchStatus === 'published'
                  ? 'Launch assessment'
                  : isEdit
                    ? 'Save draft'
                    : 'Create draft'}
            </Button>
          </div>
        </Card>
      ) : null}

      <PickStudentsModal
        open={pickStudentsOpen}
        onClose={() => setPickStudentsOpen(false)}
        items={assignees.map((a) => ({ id: a.id, email: a.email, label: a.label }))}
        alreadySelected={new Set(studentIds)}
        onImport={(ids) => setStudentIds((prev) => [...new Set([...prev, ...ids])])}
        loading={assigneesLoading}
      />
    </div>
  );
}
