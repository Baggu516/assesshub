import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useClassesQuery,
  useClassOptionsQuery,
  useClassMutations,
  type SchoolClass,
} from '@/hooks/api/useClasses';
import { useAcademicYearsQuery } from '@/hooks/api/useAcademicYears';
import { useClassMastersQuery } from '@/hooks/api/useClassMasters';

function MemberChecklist({
  title,
  items,
  selected,
  onToggle,
  loading,
  emptyText,
}: {
  title: string;
  items: { id: string; label: string; email: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
        {title} ({selected.size} selected)
      </p>
      {loading ? (
        <Skeleton className="h-24" />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          {items.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => onToggle(s.id)} />
              <span className="truncate">{s.label}</span>
              <span className="text-xs text-slate-400 truncate">{s.email}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassFormModal({
  initial,
  defaultYearId,
  onClose,
  onSave,
  saving,
}: {
  initial?: SchoolClass | null;
  defaultYearId?: string;
  onClose: () => void;
  onSave: (data: {
    academicYearId: string;
    classMasterId: string;
    section: string;
    description: string;
    teacherIds: string[];
    studentIds: string[];
  }) => void;
  saving: boolean;
}) {
  const { data: options, isLoading } = useClassOptionsQuery();
  const { data: years = [] } = useAcademicYearsQuery();
  const { data: masters = [] } = useClassMastersQuery();

  const [academicYearId, setAcademicYearId] = useState(
    initial?.academicYearId || defaultYearId || ''
  );
  const [classMasterId, setClassMasterId] = useState(initial?.classMasterId || '');
  const [section, setSection] = useState(initial?.section || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [teachers, setTeachers] = useState<Set<string>>(
    () => new Set((initial?.teachers || []).map((t) => t.id))
  );
  const [students, setStudents] = useState<Set<string>>(
    () => new Set((initial?.students || []).map((s) => s.id))
  );

  const toggle = (set: typeof setTeachers) => (id: string) => {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSave = !!academicYearId && !!classMasterId;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    onSave({
      academicYearId,
      classMasterId,
      section: section.trim(),
      description: description.trim(),
      teacherIds: [...teachers],
      studentIds: [...students],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {initial ? 'Edit academic class' : 'Create academic class'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pick a year, grade master, and section (e.g. Grade 5 + A → Grade 5 A for 2026-27).
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-xs text-slate-500 space-y-1">
            <span>Academic year *</span>
            <select
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              required
            >
              <option value="">Select year…</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-500 space-y-1">
            <span>Class master *</span>
            <select
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
              value={classMasterId}
              onChange={(e) => setClassMasterId(e.target.value)}
              required
            >
              <option value="">Select grade…</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <input
            placeholder="Section (e.g. A)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <MemberChecklist
            title="Teachers (optional)"
            items={options?.teachers || []}
            selected={teachers}
            onToggle={toggle(setTeachers)}
            loading={isLoading}
            emptyText="No teachers yet. Create them under Teachers first."
          />

          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (options?.students?.length || 0) > 0 ? (
            <MemberChecklist
              title="Students (optional)"
              items={options?.students || []}
              selected={students}
              onToggle={toggle(setStudents)}
              loading={false}
              emptyText=""
            />
          ) : (
            <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-3">
              No students yet — create the class now and enroll students later.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create class'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function ClassesPage() {
  const { data: years = [] } = useAcademicYearsQuery();
  const currentYear = useMemo(
    () => years.find((y) => y.isCurrent) || years[0] || null,
    [years]
  );
  const [yearFilter, setYearFilter] = useState<string>('');
  const effectiveYearId = yearFilter === 'all' ? null : yearFilter || currentYear?.id || null;

  const { data: classes = [], isLoading } = useClassesQuery(true, effectiveYearId);
  const { create, update, remove } = useClassMutations();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SchoolClass | null>(null);

  const sorted = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  );

  const handleSave = async (form: {
    academicYearId: string;
    classMasterId: string;
    section: string;
    description: string;
    teacherIds: string[];
    studentIds: string[];
  }) => {
    try {
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, ...form });
        toast.success('Class updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Class created');
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save class');
    }
  };

  const handleDelete = async (klass: SchoolClass) => {
    if (!window.confirm(`Archive class "${klass.name}"? Enrollments are ended; history is kept.`)) return;
    try {
      await remove.mutateAsync(klass.id);
      toast.success('Class archived');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to archive class');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic classes"
        description="A class is a grade + section for one academic year. Students enroll here — history is preserved across promotions."
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            disabled={!years.length}
          >
            New class
          </Button>
        }
      />

      {!years.length ? (
        <Card className="p-6 text-sm text-slate-500">
          Create an academic year first under <span className="font-medium">Academic years</span>, then
          add class masters, then open classes here.
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-slate-500 flex items-center gap-2">
            Year
            <select
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
              value={yearFilter === 'all' ? 'all' : effectiveYearId || ''}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No academic classes for this year yet. Create one from a class master and section.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((c) => (
            <Card key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-slate-900 dark:text-white">{c.name}</h3>
                  {c.academicYear ? <Badge tone="neutral">{c.academicYear}</Badge> : null}
                  {c.section ? <Badge tone="neutral">Sec {c.section}</Badge> : null}
                  <Badge tone="info">
                    {c.teacherCount} teacher{c.teacherCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge tone="info">
                    {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {c.description ? <p className="text-xs text-slate-500 mt-1">{c.description}</p> : null}
                {c.teachers && c.teachers.length > 0 ? (
                  <p className="text-xs text-slate-500 mt-2">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Teachers: </span>
                    {c.teachers.map((t) => t.label).join(', ')}
                  </p>
                ) : null}
                {c.students && c.students.length > 0 ? (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Students: </span>
                    {c.students.map((s) => s.label).join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditTarget(c);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(c)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <ClassFormModal
          key={editTarget?.id || 'new'}
          initial={editTarget}
          defaultYearId={effectiveYearId || undefined}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          onSave={handleSave}
          saving={create.isPending || update.isPending}
        />
      ) : null}
    </div>
  );
}
