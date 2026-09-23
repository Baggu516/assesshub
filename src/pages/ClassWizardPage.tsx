import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import {
  useClassMutations,
  useClassOptionsQuery,
  useClassQuery,
  type ClassMemberRow,
} from '@/hooks/api/useClasses';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import { useClassMastersQuery } from '@/hooks/api/useClassMasters';

const selectClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Students' },
  { id: 3, label: 'Teachers' },
] as const;

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

function PickMembersModal({
  open,
  onClose,
  title,
  items,
  alreadySelected,
  onImport,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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

  const selectAllVisible = () => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const m of available) next.add(m.id);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description="Select people to add to this class."
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
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          {available.length > 0 ? (
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Select all shown
            </button>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {items.length === 0 ? 'No people available yet.' : 'Everyone matching is already added, or no matches.'}
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
                      className={clsx(
                        'cursor-pointer transition-colors',
                        checked ? 'bg-brand-50/70 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      )}
                      onClick={() => toggle(m.id)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
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

function MembersTable({
  rows,
  onRemove,
  emptyTitle,
  emptyDescription,
}: {
  rows: ClassMemberRow[];
  onRemove: (id: string) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="rounded-xl border border-dashed border-slate-200 py-10 dark:border-slate-700"
      />
    );
  }

  return (
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
          {rows.map((m) => (
            <tr key={m.id} className="bg-white dark:bg-slate-950/40">
              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{m.label}</td>
              <td className="px-4 py-2.5 text-slate-500">{m.email}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(m.id)}
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
  );
}

export function ClassWizardPage() {
  const { classId } = useParams<{ classId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(classId);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsQuery();
  const { data: masters = [], isLoading: mastersLoading } = useClassMastersQuery();
  const { data: options, isLoading: optionsLoading } = useClassOptionsQuery();
  const { data: existing, isLoading: existingLoading } = useClassQuery(classId);
  const { create, update } = useClassMutations();

  const currentYear = useMemo(
    () => years.find((y) => y.isCurrent) || years[0] || null,
    [years]
  );

  const [step, setStep] = useState(1);
  const [academicYearId, setAcademicYearId] = useState('');
  const [classMasterId, setClassMasterId] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [pickStudentsOpen, setPickStudentsOpen] = useState(false);
  const [pickTeachersOpen, setPickTeachersOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    if (academicYearId || !years.length) return;
    const fromQuery = searchParams.get('year');
    setAcademicYearId(fromQuery || currentYear?.id || '');
  }, [isEdit, years, currentYear, academicYearId, searchParams]);

  useEffect(() => {
    if (!isEdit || !existing || hydrated) return;
    setAcademicYearId(existing.academicYearId || '');
    setClassMasterId(existing.classMasterId || '');
    setSection(existing.section || '');
    setDescription(existing.description || '');
    setStudentIds((existing.students || []).map((s) => s.id));
    setTeacherIds((existing.teachers || []).map((t) => t.id));
    setHydrated(true);
  }, [isEdit, existing, hydrated]);

  const studentById = useMemo(() => {
    const map = new Map<string, ClassMemberRow>();
    for (const s of options?.students || []) map.set(s.id, s);
    for (const s of existing?.students || []) map.set(s.id, s);
    return map;
  }, [options?.students, existing?.students]);

  const teacherById = useMemo(() => {
    const map = new Map<string, ClassMemberRow>();
    for (const t of options?.teachers || []) map.set(t.id, t);
    for (const t of existing?.teachers || []) map.set(t.id, t);
    return map;
  }, [options?.teachers, existing?.teachers]);

  const selectedStudents = useMemo(
    () => studentIds.map((id) => studentById.get(id)).filter(Boolean) as ClassMemberRow[],
    [studentIds, studentById]
  );

  const selectedTeachers = useMemo(
    () => teacherIds.map((id) => teacherById.get(id)).filter(Boolean) as ClassMemberRow[],
    [teacherIds, teacherById]
  );

  const canContinueDetails = Boolean(academicYearId && classMasterId);
  const saving = create.isPending || update.isPending;
  const bootLoading = yearsLoading || mastersLoading || (isEdit && existingLoading);

  const importStudents = (ids: string[]) => {
    setStudentIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const importTeachers = (ids: string[]) => {
    setTeacherIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleFinish = async () => {
    if (!canContinueDetails || saving) return;
    try {
      if (isEdit && classId) {
        await update.mutateAsync({
          id: classId,
          academicYearId,
          classMasterId,
          section: section.trim(),
          description: description.trim(),
          teacherIds,
          studentIds,
        });
        toast.success('Class updated');
      } else {
        await create.mutateAsync({
          academicYearId,
          classMasterId,
          section: section.trim(),
          description: description.trim(),
          teacherIds,
          studentIds,
        });
        toast.success('Class created');
      }
      navigate('/classes');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save class');
    }
  };

  if (bootLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        Class not found.{' '}
        <Link to="/classes" className="font-medium text-brand-600 hover:underline">
          Back to classes
        </Link>
      </Card>
    );
  }

  if (!years.length) {
    return (
      <Card className="p-8 text-sm text-slate-500">
        Create an academic year first, then return here to create a class.
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Academic classes"
        title={isEdit ? 'Edit class' : 'New class'}
        description="Three steps: details, students, then teachers."
        actions={
          <Button variant="secondary" onClick={() => navigate('/classes')}>
            Cancel
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <Stepper step={step} />
      </Card>

      {step === 1 ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Class details</h2>
            <p className="mt-0.5 text-sm text-slate-500">Year, grade, and section for this class.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Academic year" htmlFor="wiz-year" required>
              <select
                id="wiz-year"
                className={selectClass}
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                <option value="">Select year…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Class master" htmlFor="wiz-master" required>
              <select
                id="wiz-master"
                className={selectClass}
                value={classMasterId}
                onChange={(e) => setClassMasterId(e.target.value)}
              >
                <option value="">Select grade…</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Section" htmlFor="wiz-section">
              <Input
                id="wiz-section"
                placeholder="e.g. A"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </FormField>
            <FormField label="Description" htmlFor="wiz-description">
              <Textarea
                id="wiz-description"
                placeholder="Optional"
                className="min-h-[42px] rounded-lg"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" disabled={!canContinueDetails} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Students</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {selectedStudents.length} selected · add from your student directory
              </p>
            </div>
            <Button type="button" onClick={() => setPickStudentsOpen(true)}>
              Add students
            </Button>
          </div>

          <MembersTable
            rows={selectedStudents}
            onRemove={(id) => setStudentIds((prev) => prev.filter((x) => x !== id))}
            emptyTitle="No students yet"
            emptyDescription="Click Add students to select and import into this class."
          />

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Teachers</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {selectedTeachers.length} selected · optional, you can add later
              </p>
            </div>
            <Button type="button" onClick={() => setPickTeachersOpen(true)}>
              Add teachers
            </Button>
          </div>

          <MembersTable
            rows={selectedTeachers}
            onRemove={(id) => setTeacherIds((prev) => prev.filter((x) => x !== id))}
            emptyTitle="No teachers yet"
            emptyDescription="Click Add teachers to assign teachers to this class."
          />

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900/60">
            <span className="font-medium text-slate-600 dark:text-slate-300">Summary: </span>
            {masters.find((m) => m.id === classMasterId)?.name || 'Grade'}
            {section ? ` · Sec ${section}` : ''}
            {' · '}
            <Badge tone="info">{selectedStudents.length} students</Badge>{' '}
            <Badge tone="info">{selectedTeachers.length} teachers</Badge>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={saving || !canContinueDetails} onClick={handleFinish}>
              {saving ? 'Saving…' : isEdit ? 'Save class' : 'Create class'}
            </Button>
          </div>
        </Card>
      ) : null}

      <PickMembersModal
        open={pickStudentsOpen}
        onClose={() => setPickStudentsOpen(false)}
        title="Add students"
        items={options?.students || []}
        alreadySelected={new Set(studentIds)}
        onImport={importStudents}
        loading={optionsLoading}
      />
      <PickMembersModal
        open={pickTeachersOpen}
        onClose={() => setPickTeachersOpen(false)}
        title="Add teachers"
        items={options?.teachers || []}
        alreadySelected={new Set(teacherIds)}
        onImport={importTeachers}
        loading={optionsLoading}
      />
    </div>
  );
}
