import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { useAssessmentAssigneesQuery } from '@/hooks/api/useAssessments';
import {
  useStudentGroupsQuery,
  useStudentGroupMutations,
  type StudentGroup,
} from '@/hooks/api/useStudentGroups';

function GroupFormModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {initial ? 'Edit group' : 'Create student group'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Add students to a group. Assign assessments to the whole group at once.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            placeholder="Group name *"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Students * ({selected.size} selected)
            </p>
            {isLoading ? (
              <Skeleton className="h-24" />
            ) : students.length === 0 ? (
              <p className="text-sm text-slate-500">No students available. Create students first.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    <span>{s.label}</span>
                    <span className="text-xs text-slate-400">{s.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || saving}>
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create group'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
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
        <Card className="p-8 text-center text-sm text-slate-500">
          No groups yet. Create a group and add students to assign assessments in bulk.
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedGroups.map((g) => (
            <Card key={g.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-slate-900 dark:text-white">{g.name}</h3>
                  <Badge tone="info">{g.memberCount} student{g.memberCount !== 1 ? 's' : ''}</Badge>
                </div>
                {g.description && <p className="text-xs text-slate-500 mt-1">{g.description}</p>}
                {g.members && g.members.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    {g.members.map((m) => m.label).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
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
