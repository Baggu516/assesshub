import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
} from '@/components/ui';
import {
  useAssessmentAssigneesQuery,
  type AssessmentAssignee,
} from '@/hooks/api/useAssessments';
import {
  useStudentGroupsQuery,
  useStudentGroupMutations,
  type StudentGroup,
} from '@/hooks/api/useStudentGroups';

function GroupFormModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial?: StudentGroup | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string; studentIds: string[] }) => void;
  saving: boolean;
}) {
  const { data: students = [], isLoading } = useAssessmentAssigneesQuery();
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial?.studentIds || [])
  );
  const [classTab, setClassTab] = useState('all');

  const classTabs = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const s of students) {
      for (const c of s.classes || []) {
        const existing = byId.get(c.id);
        if (existing) existing.count += 1;
        else byId.set(c.id, { id: c.id, name: c.name, count: 1 });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  useEffect(() => {
    if (classTab === 'all') return;
    if (!classTabs.some((c) => c.id === classTab)) setClassTab('all');
  }, [classTab, classTabs]);

  const visibleStudents = useMemo(() => {
    if (classTab === 'all') return students;
    return students.filter((s) => (s.classes || []).some((c) => c.id === classTab));
  }, [students, classTab]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of visibleStudents) next.add(s.id);
      return next;
    });
  };

  const clearVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of visibleStudents) next.delete(s.id);
      return next;
    });
  };

  const canSave = name.trim().length > 0 && selected.size > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      studentIds: [...selected],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Edit group' : 'Create student group'}
      description="Add students to a group. Assign assessments to the whole group at once."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="student-group-form" disabled={!canSave || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create group'}
          </Button>
        </>
      }
    >
      <form id="student-group-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Group name" htmlFor="group-name" required>
          <Input
            id="group-name"
            placeholder="e.g. Quiz batch A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Description" htmlFor="group-description" hint="Optional">
          <Textarea
            id="group-description"
            placeholder="What this group is for…"
            className="min-h-[64px] rounded-xl"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Students <span className="text-rose-500">*</span>
              <span className="ml-1 font-normal text-slate-400">({selected.size} selected)</span>
            </p>
            {visibleStudents.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectVisible}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Select {classTab === 'all' ? 'all' : 'class'}
                </button>
                <button
                  type="button"
                  onClick={clearVisible}
                  className="text-xs font-medium text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {classTabs.length > 0 && (
            <div className="mb-2 flex gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setClassTab('all')}
                className={clsx(
                  'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  classTab === 'all'
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                All ({students.length})
              </button>
              {classTabs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClassTab(c.id)}
                  className={clsx(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    classTab === c.id
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {c.name} ({c.count})
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-24" />
          ) : students.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
              No students in your classes yet. Ask admin to enroll them under Classes.
            </p>
          ) : visibleStudents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
              No students in this class.
            </p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {visibleStudents.map((s: AssessmentAssignee) => {
                const checked = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={clsx(
                      'flex w-full items-start gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      checked
                        ? 'border-brand-400 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-500/10'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                        checked
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 dark:border-slate-500'
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white">
                        {s.label}
                      </span>
                      <span className="block text-xs text-slate-500">{s.email}</span>
                      {classTab === 'all' && (s.classes?.length ?? 0) > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.classes!.map((c) => (
                            <Badge key={c.id} tone="brand" className="!py-0.5 !text-[10px]">
                              {c.name}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function GroupStudentsPage() {
  const { data: groups = [], isLoading } = useStudentGroupsQuery();
  const { create, update, remove } = useStudentGroupMutations();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentGroup | null>(null);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );

  const handleSave = async (form: { name: string; description: string; studentIds: string[] }) => {
    try {
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, ...form });
        toast.success('Group updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Group created');
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save group');
    }
  };

  const handleDelete = async (group: StudentGroup) => {
    if (!window.confirm(`Delete group "${group.name}"?`)) return;
    try {
      await remove.mutateAsync(group.id);
      toast.success('Group deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to delete group');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group students"
        description="Organize students into groups. When you assign an assessment, pick a group and every member can take it."
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
          >
            New group
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : sortedGroups.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No groups yet"
            description="Create a group and add students to assign assessments in bulk."
            action={
              <Button
                onClick={() => {
                  setEditTarget(null);
                  setShowForm(true);
                }}
              >
                New group
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map((g) => (
            <Card key={g.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{g.name}</h3>
                  <Badge tone="info">
                    {g.memberCount} student{g.memberCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {g.description && <p className="mt-1 text-xs text-slate-500">{g.description}</p>}
                {g.members && g.members.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {g.members.map((m) => m.label).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditTarget(g);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(g)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <GroupFormModal
          open
          initial={editTarget}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          onSave={handleSave}
          saving={create.isPending || update.isPending}
        />
      )}
    </div>
  );
}
