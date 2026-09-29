import { useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/permissions';
import { formatPermissionList, permissionVisibleFor } from '@/constants/permissionLabels';
import { resolveOrgFeatures } from '@/lib/sessionCache';
import {
  downloadTeacherImportTemplate,
  parseTeacherImportCsv,
  type PersonImportRow,
} from '@/lib/csv';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import {
  usePermissionsCatalogQuery,
  useSubordinatesQuery,
  useUserMutations,
  type UserListRow,
} from '@/hooks/api/useUsers';
import { isValidEmail } from '@/lib/validation';

type ImportResultRow = {
  row: number;
  email: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  registrationId?: string;
  generatedPassword?: string;
};

function ImportTeachersModal({
  open,
  onClose,
  importing,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  importing: boolean;
  onImport: (teachers: { email: string; firstName?: string; lastName?: string; password?: string }[]) => Promise<
    ImportResultRow[] | null
  >;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PersonImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);

  const reset = () => {
    setRows([]);
    setParseError(null);
    setFileName(null);
    setResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const onFile = async (file: File | null) => {
    setResults(null);
    setParseError(null);
    setRows([]);
    setFileName(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes('csv') && file.type !== 'text/plain') {
      setParseError('Please upload a .csv file');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseTeacherImportCsv(text);
      if (parsed.error) {
        setParseError(parsed.error);
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
    } catch {
      setParseError('Could not read file');
    }
  };

  const preview = useMemo(() => {
    const seen = new Set<string>();
    let dupInFile = 0;
    let validUnique = 0;
    for (const r of rows) {
      const email = r.email.trim().toLowerCase();
      if (!email || !isValidEmail(email)) continue;
      if (seen.has(email)) {
        dupInFile += 1;
        continue;
      }
      seen.add(email);
      if (r.password.trim() && r.password.trim().length < 8) continue;
      validUnique += 1;
    }
    return { dupInFile, validUnique };
  }, [rows]);

  const canSubmit = rows.length > 0 && preview.validUnique > 0 && !importing && !results;

  const handleImport = async () => {
    if (!canSubmit) return;
    const teachers = rows.map((r) => ({
      email: r.email.trim(),
      firstName: r.firstName.trim() || undefined,
      lastName: r.lastName.trim() || undefined,
      ...(r.password.trim() ? { password: r.password.trim() } : {}),
    }));
    const res = await onImport(teachers);
    if (res) setResults(res);
  };

  const createdCount = results?.filter((r) => r.ok).length ?? 0;
  const skippedCount = results?.filter((r) => !r.ok && r.skipped).length ?? 0;
  const failedCount = results?.filter((r) => !r.ok && !r.skipped).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="Import teachers"
      description="Upload a CSV to create many teacher accounts at once."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={importing}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results ? (
            <Button onClick={handleImport} disabled={!canSubmit}>
              {importing
                ? 'Importing…'
                : `Create ${preview.validUnique || ''} teacher${preview.validUnique === 1 ? '' : 's'}`.trim()}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {!results ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadTeacherImportTemplate()}
                disabled={importing}
              >
                Download template
              </Button>
              <span className="text-xs text-slate-500">
                Columns: email, firstName, lastName, password (optional)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Blank password cells get an auto-generated password emailed to the teacher.
            </p>

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-center dark:border-slate-600 dark:bg-slate-900/40">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
                Choose CSV file
              </Button>
              {fileName ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {fileName} · {rows.length} teacher{rows.length === 1 ? '' : 's'}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Max 200 rows per import</p>
              )}
            </div>

            {parseError ? <p className="text-sm text-rose-600 dark:text-rose-400">{parseError}</p> : null}
            {preview.dupInFile > 0 ? (
              <p className="text-sm text-slate-500">
                {preview.dupInFile} duplicate row{preview.dupInFile === 1 ? '' : 's'} in file will be skipped.
                Existing teachers are also skipped automatically.
              </p>
            ) : rows.length > 0 ? (
              <p className="text-xs text-slate-500">
                Teachers who already exist are skipped; the rest will still be imported.
              </p>
            ) : null}

            {rows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">#</th>
                      <th className="px-2 py-1.5 font-medium">Email</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={`${r.email}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-1 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-300">{r.email}</td>
                        <td className="px-2 py-1 text-slate-700 dark:text-slate-300">
                          {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-2 py-1 text-slate-500">{r.password.trim() ? '••••••••' : 'auto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 ? (
                  <p className="border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-400 dark:border-slate-800">
                    Showing first 50 of {rows.length}
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Import finished:{' '}
              <span className="font-medium text-emerald-700 dark:text-emerald-400">{createdCount} created</span>
              {skippedCount > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-amber-700 dark:text-amber-400">{skippedCount} skipped</span>
                </>
              ) : null}
              {failedCount > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-rose-600 dark:text-rose-400">{failedCount} failed</span>
                </>
              ) : null}
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Row</th>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={`${r.row}-${r.email}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1 tabular-nums text-slate-400">{r.row}</td>
                      <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-300">{r.email || '—'}</td>
                      <td className="px-2 py-1">
                        <Badge tone={r.ok ? 'success' : r.skipped ? 'warning' : 'danger'}>
                          {r.ok ? 'OK' : r.skipped ? 'Skipped' : 'Failed'}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-slate-600 dark:text-slate-400">
                        {r.ok
                          ? [r.registrationId ? `ID ${r.registrationId}` : null, r.generatedPassword ? `pw ${r.generatedPassword}` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Created'
                          : r.error || 'Failed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => reset()}>
              Import another file
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InviteSubordinateModal({
  open,
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  form: { email: string; password: string; firstName: string; lastName: string };
  setForm: Dispatch<
    SetStateAction<{ email: string; password: string; firstName: string; lastName: string }>
  >;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
}) {
  const canCreate = useMemo(
    () =>
      isValidEmail(form.email) &&
      form.password.trim().length >= 8 &&
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0,
    [form.email, form.password, form.firstName, form.lastName]
  );

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title="Add teacher"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="invite-teacher-form" disabled={!canCreate || saving}>
            {saving ? 'Creating…' : 'Create teacher'}
          </Button>
        </>
      }
    >
      <form
        id="invite-teacher-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canCreate || saving) return;
          onSubmit(e);
        }}
        className="space-y-3"
      >
        <FormField label="Email" htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@school.edu"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </FormField>
        <FormField label="Password" htmlFor="invite-password" required hint="Min. 8 characters">
          <PasswordInput
            id="invite-password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="First name" htmlFor="invite-first-name" required>
            <Input
              id="invite-first-name"
              autoComplete="given-name"
              placeholder="Jordan"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </FormField>
          <FormField label="Last name" htmlFor="invite-last-name" required>
            <Input
              id="invite-last-name"
              autoComplete="family-name"
              placeholder="Lee"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

function SubordinateEditModal({
  open,
  target,
  catalog,
  assignableKeys,
  canEditPermissionsSection,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  target: UserListRow;
  catalog: { key: string; label: string; description?: string }[] | undefined;
  assignableKeys: Set<string>;
  canEditPermissionsSection: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [email, setEmail] = useState(target.email);
  const [firstName, setFirstName] = useState(target.firstName ?? '');
  const [lastName, setLastName] = useState(target.lastName ?? '');
  const [isActive, setIsActive] = useState(target.isActive);
  const [newPassword, setNewPassword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(target.permissions || []));

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.trim() && newPassword.trim().length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    const body: Record<string, unknown> = {
      email: email.trim(),
      firstName,
      lastName,
      isActive,
    };
    if (newPassword.trim()) body.password = newPassword.trim();
    if (canEditPermissionsSection && catalog?.length) body.permissions = [...selected];
    await onSave(body);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title="Edit teacher"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-teacher-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="edit-teacher-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Email" htmlFor="edit-email" required>
          <Input
            id="edit-email"
            required
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="First name" htmlFor="edit-first-name">
            <Input
              id="edit-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="edit-last-name">
            <Input
              id="edit-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active account
        </label>
        <FormField label="New password" htmlFor="edit-password" hint="Leave blank to keep current">
          <PasswordInput
            id="edit-password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </FormField>

        {canEditPermissionsSection && catalog && catalog.length > 0 && (
          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Permissions</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
              {catalog
                .filter((p) => assignableKeys.has(p.key))
                .map((p) => (
                  <label
                    key={p.key}
                    title={p.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.key)}
                      onChange={() => toggle(p.key)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate text-sm text-slate-800 dark:text-slate-100">{p.label}</span>
                  </label>
                ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function SubordinatesPage() {
  const { user } = useAuth();
  const { data: org } = useTenantOrganization();
  const features = resolveOrgFeatures(org);
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = useSubordinatesQuery(true, user?.id);
  const { createSubordinate, importSubordinates, updateUser } = useUserMutations();
  const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalogQuery();
  const [editTarget, setEditTarget] = useState<UserListRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const myPerms = user?.permissions as string[] | undefined;

  const canCreateTeachers =
    !!user &&
    user.hierarchyRole === 'admin' &&
    !!myPerms?.includes(PERMISSIONS.SUBORDINATE_CREATE);

  const canOpenEdit =
    !!user &&
    (myPerms?.includes(PERMISSIONS.SETTINGS_MANAGE) ||
      myPerms?.includes(PERMISSIONS.USER_CREATE) ||
      myPerms?.includes(PERMISSIONS.SUBORDINATE_CREATE));

  const canEditPermissionsSection = Boolean(
    user &&
      !catalogLoading &&
      catalog?.length &&
      (myPerms?.includes(PERMISSIONS.SETTINGS_MANAGE) ||
        myPerms?.includes(PERMISSIONS.USER_CREATE) ||
        myPerms?.includes(PERMISSIONS.SUBORDINATE_CREATE))
  );

  const assignableKeySet = useMemo(() => {
    if (!user || !catalog) return new Set<string>();
    const keys = new Set<string>();
    for (const row of catalog) {
      if (permissionVisibleFor(row, 'subordinate', features)) keys.add(row.key);
    }
    return keys;
  }, [user, catalog, features]);

  const filteredRows = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => {
      const email = u.email?.toLowerCase() ?? '';
      const fn = u.firstName?.toLowerCase() ?? '';
      const ln = u.lastName?.toLowerCase() ?? '';
      return email.includes(q) || fn.includes(q) || ln.includes(q);
    });
  }, [data, search]);

  const onSubmitInvite = async (e: FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    const pw = form.password.trim();
    if (!email || !isValidEmail(form.email)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (!pw) {
      toast.error('Password is required');
      return;
    }
    if (pw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    try {
      const res = (await createSubordinate.mutateAsync({
        ...form,
        email,
        password: pw,
      })) as { user?: { registrationId?: string } };
      const rid = res?.user?.registrationId;
      toast.success(rid ? `Teacher created · ID ${rid}` : 'Subordinate created');
      setForm({ email: '', password: '', firstName: '', lastName: '' });
      setInviteOpen(false);
      refetch();
    } catch {
      toast.error('Could not create subordinate');
    }
  };

  const onSaveEdit = async (body: Record<string, unknown>) => {
    if (!editTarget) return;
    try {
      await updateUser.mutateAsync({
        id: editTarget.id,
        body,
      });
      toast.success('Subordinate updated');
      setEditTarget(null);
      refetch();
    } catch {
      toast.error('Could not update subordinate');
    }
  };

  const runImport = async (
    teachers: { email: string; firstName?: string; lastName?: string; password?: string }[]
  ) => {
    try {
      const data = await importSubordinates.mutateAsync({ teachers });
      const skipped = data.skipped ?? 0;
      if (data.failed === 0 && data.created > 0) {
        toast.success(
          skipped > 0
            ? `Created ${data.created}, skipped ${skipped} existing`
            : `Created ${data.created} teacher${data.created === 1 ? '' : 's'}`
        );
      } else if (data.created === 0 && data.failed === 0 && skipped > 0) {
        toast.success(`All ${skipped} already existed — skipped`);
      } else if (data.created === 0 && data.failed > 0) {
        toast.error(`Import failed for ${data.failed} row${data.failed === 1 ? '' : 's'}`);
      } else {
        toast.success(
          `Created ${data.created}${skipped ? `, skipped ${skipped}` : ''}${data.failed ? `, ${data.failed} failed` : ''}`
        );
      }
      refetch();
      return data.results;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Import failed');
      return null;
    }
  };

  return (
    <div className="ah-page">
      {canCreateTeachers && (
        <InviteSubordinateModal
          open={inviteOpen}
          form={form}
          setForm={setForm}
          saving={createSubordinate.isPending}
          onClose={() => {
            if (createSubordinate.isPending) return;
            setForm({ email: '', password: '', firstName: '', lastName: '' });
            setInviteOpen(false);
          }}
          onSubmit={onSubmitInvite}
        />
      )}

      {canCreateTeachers && (
        <ImportTeachersModal
          open={importOpen}
          importing={importSubordinates.isPending}
          onClose={() => {
            if (importSubordinates.isPending) return;
            setImportOpen(false);
          }}
          onImport={runImport}
        />
      )}

      {canOpenEdit && editTarget && (
        <SubordinateEditModal
          key={editTarget.id}
          open={!!editTarget}
          target={editTarget}
          catalog={catalog}
          assignableKeys={assignableKeySet}
          canEditPermissionsSection={canEditPermissionsSection}
          saving={updateUser.isPending}
          onClose={() => {
            if (updateUser.isPending) return;
            setEditTarget(null);
          }}
          onSave={onSaveEdit}
        />
      )}

      <PageHeader
        eyebrow="Team"
        title="Teachers"
        description="Create or import teachers, then assign them to classes."
        actions={
          canCreateTeachers ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
              <Button onClick={() => setInviteOpen(true)}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add teacher
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="ah-table-wrap">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-700/80 sm:px-5">
          <div className="relative max-w-md">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="pl-10"
              inputSize="sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800"
                >
                  <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.length ? (
            <EmptyState
              title="No teachers yet"
              description="Add or import teachers to get started."
              action={
                canCreateTeachers ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" onClick={() => setImportOpen(true)}>
                      Import CSV
                    </Button>
                    <Button onClick={() => setInviteOpen(true)}>Add teacher</Button>
                  </div>
                ) : undefined
              }
            />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try a different search term."
              action={
                <Button variant="secondary" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  {canOpenEdit && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((u: UserListRow) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
                  const initials = name
                    ? name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join('')
                        .toUpperCase()
                    : u.email.slice(0, 2).toUpperCase();
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            {name ? (
                              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                {name}
                              </p>
                            ) : null}
                            <code className="truncate font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                              {u.email}
                            </code>
                            {u.registrationId ? (
                              <p className="mt-0.5 font-mono text-[11px] font-semibold tracking-wide text-brand-700 dark:text-brand-300">
                                ID {u.registrationId}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="brand">Teacher</Badge>
                      </td>
                      <td>
                        <Badge tone={u.isActive ? 'success' : 'neutral'}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                          {u.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                        <span className="line-clamp-2">{formatPermissionList(u.permissions)}</span>
                      </td>
                      {canOpenEdit && (
                        <td className="whitespace-nowrap text-right">
                          <Button variant="secondary" size="sm" onClick={() => setEditTarget(u)}>
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!canOpenEdit && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
            You need permission to manage users to edit teachers.
          </p>
        )}
      </div>
    </div>
  );
}
