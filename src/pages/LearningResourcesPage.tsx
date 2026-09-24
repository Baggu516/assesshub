import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, FormField, Input, Modal, PageHeader, Skeleton, Textarea } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useClassesQuery } from '@/hooks/api/useClasses';
import {
  downloadLearningResource,
  useLearningResourceMutations,
  useLearningResourcesQuery,
  type LearningResource,
  type ResourceKind,
} from '@/hooks/api/useLearningResources';

function formatBytes(size: number) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function toLocal(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const copy = {
  eyebrow: 'Materials',
  title: 'Worksheets',
  description: 'Upload a PDF or Word file. Students in the selected classes can download it.',
  empty: 'No worksheets yet',
  emptyBody: 'Add a PDF or Word document for a class to download.',
  studentEmpty: 'No worksheets have been shared with your class yet.',
} as const;

export function LearningResourcesPage({ kind }: { kind: ResourceKind }) {
  const { user } = useAuth();
  const isStudent = user?.hierarchyRole === 'user';
  const { data: items = [], isLoading } = useLearningResourcesQuery(kind);
  const { create, update, remove } = useLearningResourceMutations(kind);
  const { data: classes = [] } = useClassesQuery(!isStudent);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningResource | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const saving = create.isPending || update.isPending;

  const classOptions = useMemo(
    () => classes.map((c) => ({ id: c.id, label: c.academicYear ? `${c.name} · ${c.academicYear}` : c.name })),
    [classes]
  );

  const reset = (item?: LearningResource | null) => {
    setEditing(item || null);
    setTitle(item?.title || '');
    setDescription(item?.description || '');
    setClassIds(item?.classIds || []);
    setStartAt(toLocal(item?.startAt));
    setEndAt(toLocal(item?.endAt));
    setFile(null);
    setPublished(item ? item.isPublished : true);
    setFileInputKey((key) => key + 1);
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setTitle('');
    setDescription('');
    setClassIds([]);
    setStartAt('');
    setEndAt('');
    setFile(null);
    setPublished(true);
    setFileInputKey((key) => key + 1);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!classIds.length) {
      toast.error('Select at least one class');
      return;
    }
    if (!editing && !file) {
      toast.error('Upload a PDF or Word file');
      return;
    }
    try {
      const payload = {
        kind,
        title: title.trim(),
        description: description.trim(),
        classIds,
        startAt,
        endAt,
        dueAt: '',
        isPublished: published,
        file,
      };
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      toast.success(editing ? 'Saved' : 'Created');
      setOpen(false);
      setEditing(null);
      setTitle('');
      setDescription('');
      setClassIds([]);
      setStartAt('');
      setEndAt('');
      setFile(null);
      setPublished(true);
      setFileInputKey((key) => key + 1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not save');
    }
  };

  const onDownload = async (item: LearningResource) => {
    if (!item.hasFile) return;
    if (item.isNotYetOpen) {
      toast.error('Download is not open yet');
      return;
    }
    if (item.isClosed) {
      toast.error('Download is closed');
      return;
    }
    try {
      await downloadLearningResource(item.id, item.fileName);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not download');
    }
  };

  const onDelete = async (item: LearningResource) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusyId(item.id);
    try {
      await remove.mutateAsync(item.id);
      toast.success('Deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not delete');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={isStudent ? 'Files shared with your class.' : copy.description}
        actions={
          isStudent ? null : (
            <Button onClick={() => reset(null)}>+ New worksheet</Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={copy.empty}
            description={isStudent ? copy.studentEmpty : copy.emptyBody}
            action={
              isStudent ? undefined : (
                <Button onClick={() => reset(null)}>Create worksheet</Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col p-5">
              <div className="mb-2 flex flex-wrap gap-2">
                {!item.isPublished ? <Badge tone="neutral">Draft</Badge> : null}
                {item.isNotYetOpen ? <Badge tone="warning">Not open yet</Badge> : null}
                {item.isClosed ? <Badge tone="neutral">Closed</Badge> : null}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
              {item.description ? (
                <p className="mt-1 line-clamp-3 text-sm text-slate-500">{item.description}</p>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">
                {(item.classNames || []).join(', ') || 'Class'}
                {item.fileName ? ` · ${item.fileName}` : ''}
                {item.fileSize ? ` · ${formatBytes(item.fileSize)}` : ''}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {item.hasFile ? (
                  <Button size="sm" onClick={() => onDownload(item)} disabled={item.isNotYetOpen || item.isClosed}>
                    Download
                  </Button>
                ) : null}
                {!isStudent ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => reset(item)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? 'Edit worksheet' : 'New worksheet'}
      >
        <div className="space-y-4">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </FormField>
          <FormField label="Classes">
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {classOptions.length === 0 ? (
                <p className="text-sm text-slate-500">No classes yet.</p>
              ) : (
                classOptions.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={classIds.includes(c.id)}
                      onChange={() =>
                        setClassIds((prev) =>
                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        )
                      }
                    />
                    {c.label}
                  </label>
                ))
              )}
            </div>
          </FormField>
          <FormField label="PDF or Word file">
            <Input
              key={fileInputKey}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {editing?.fileName ? (
              <p className="mt-1 text-xs text-slate-500">Current file: {editing.fileName}</p>
            ) : null}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Opens">
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </FormField>
            <FormField label="Closes">
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published for students
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
