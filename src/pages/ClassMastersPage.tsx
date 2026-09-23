import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Spinner';
import {
  useClassMastersQuery,
  useClassMasterMutations,
  type ClassMaster,
} from '@/hooks/api/useClassMasters';

const selectClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';

function MasterFormModal({
  open,
  initial,
  masters,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial?: ClassMaster | null;
  masters: ClassMaster[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    nextClassMasterId: string | null;
    sortOrder: number;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [nextClassMasterId, setNextClassMasterId] = useState(initial?.nextClassMasterId || '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));

  const nextOptions = useMemo(
    () => masters.filter((m) => m.id !== initial?.id),
    [masters, initial?.id]
  );

  const canSave = name.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      nextClassMasterId: nextClassMasterId || null,
      sortOrder: Number(sortOrder) || 0,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit class master' : 'New class master'}
      description="Stable grade names reused each year."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="master-form" disabled={!canSave || saving}>
            {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="master-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Name" htmlFor="master-name" required>
          <Input
            id="master-name"
            placeholder="e.g. Grade 5"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Description" htmlFor="master-description">
          <Textarea
            id="master-description"
            placeholder="Optional"
            className="min-h-[56px] rounded-lg"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Promotes to" htmlFor="master-next">
            <select
              id="master-next"
              className={selectClass}
              value={nextClassMasterId}
              onChange={(e) => setNextClassMasterId(e.target.value)}
            >
              <option value="">Same grade / none</option>
              {nextOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Sort order" htmlFor="master-sort">
            <Input
              id="master-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export function ClassMastersPage() {
  const { data: masters = [], isLoading } = useClassMastersQuery();
  const { create, update, remove } = useClassMasterMutations();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassMaster | null>(null);

  const byId = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters]);

  const handleSave = async (form: {
    name: string;
    description: string;
    nextClassMasterId: string | null;
    sortOrder: number;
  }) => {
    try {
      if (editTarget) {
        await update.mutateAsync({ id: editTarget.id, ...form });
        toast.success('Class master updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Class master created');
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to save');
    }
  };

  const handleDelete = async (m: ClassMaster) => {
    if (!window.confirm(`Archive "${m.name}"? Academic classes using it must be archived first.`)) return;
    try {
      await remove.mutateAsync(m.id);
      toast.success('Class master archived');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to archive');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class masters"
        description="Define grade levels once. Each year you open academic classes (Grade 5 A, Grade 5 B) from these masters."
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
          >
            New master
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : masters.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No class masters yet. Add Grade 1, Grade 2, … and set each “promotes to” the next grade.
        </Card>
      ) : (
        <div className="space-y-3">
          {masters.map((m) => (
            <Card key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-slate-900 dark:text-white">{m.name}</h3>
                {m.description ? <p className="text-xs text-slate-500 mt-1">{m.description}</p> : null}
                <p className="text-xs text-slate-500 mt-1">
                  Promotes to:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {m.nextClassMasterId
                      ? byId.get(m.nextClassMasterId)?.name || 'Unknown'
                      : 'Same / none'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditTarget(m);
                    setShowForm(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => handleDelete(m)}>
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MasterFormModal
        key={editTarget?.id || 'new'}
        open={showForm}
        initial={editTarget}
        masters={masters}
        onClose={() => {
          setShowForm(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
        saving={create.isPending || update.isPending}
      />
    </div>
  );
}
