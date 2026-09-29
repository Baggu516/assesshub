import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import type { AuthUser } from '@/types/user';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { formatPermissionList, permissionVisibleFor } from '@/constants/permissionLabels';
import { resolveOrgFeatures } from '@/lib/sessionCache';
import {
  downloadStudentImportTemplate,
  parseStudentImportCsv,
  type StudentImportRow,
} from '@/lib/csv';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import {
  usePermissionsCatalogQuery,
  useUserMutations,
  useUsersQuery,
  type UserListRow,
} from '@/hooks/api/useUsers';
import { isValidEmail } from '@/lib/validation';

const PAGE_SIZES = [5, 10, 15, 20] as const;

type MemberForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

function pageWindow(current: number, count: number) {
  const size = 5;
  let start = Math.max(1, current - Math.floor(size / 2));
  const end = Math.min(count, start + size - 1);
  start = Math.max(1, end - size + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

function AddTeamMemberModal({
  open,
  member,
  setMember,
  onClose,
  onCreateUser,
  onInviteOnly,
  createPending,
  invitePending,
}: {
  open: boolean;
  member: MemberForm;
  setMember: Dispatch<SetStateAction<MemberForm>>;
  onClose: () => void;
  onCreateUser: () => void;
  onInviteOnly: () => void;
  createPending: boolean;
  invitePending: boolean;
}) {
  const canCreateUser = useMemo(() => {
    return (
      isValidEmail(member.email) &&
      member.password.trim().length >= 8 &&
      member.firstName.trim().length > 0 &&
      member.lastName.trim().length > 0
    );
  }, [member]);

  const canInviteOnly = useMemo(() => isValidEmail(member.email), [member.email]);

  const busy = createPending || invitePending;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      title="Add student"
      description="Create with password, or send an email invite."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onInviteOnly} disabled={!canInviteOnly || busy}>
            {invitePending ? 'Sending…' : 'Email invite'}
          </Button>
          <Button onClick={onCreateUser} disabled={!canCreateUser || busy}>
            {createPending ? 'Creating…' : 'Create student'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Email" htmlFor="add-student-email" required>
          <Input
            id="add-student-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@school.edu"
            value={member.email}
            onChange={(e) => setMember((m) => ({ ...m, email: e.target.value }))}
          />
        </FormField>
        <FormField label="Password" htmlFor="add-student-password" required hint="Min. 8 characters to create">
          <PasswordInput
            id="add-student-password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={member.password}
            onChange={(e) => setMember((m) => ({ ...m, password: e.target.value }))}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="First name" htmlFor="add-student-first" required>
            <Input
              id="add-student-first"
              autoComplete="given-name"
              placeholder="Jordan"
              value={member.firstName}
              onChange={(e) => setMember((m) => ({ ...m, firstName: e.target.value }))}
            />
          </FormField>
          <FormField label="Last name" htmlFor="add-student-last" required>
            <Input
              id="add-student-last"
              autoComplete="family-name"
              placeholder="Lee"
              value={member.lastName}
              onChange={(e) => setMember((m) => ({ ...m, lastName: e.target.value }))}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

type ImportMode = 'create' | 'invite';

type ImportResultRow = {
  row: number;
  email: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  registrationId?: string;
  generatedPassword?: string;
};

function ImportStudentsModal({
  open,
  onClose,
  importing,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  importing: boolean;
  onImport: (payload: {
    mode: ImportMode;
    students: { email: string; firstName?: string; lastName?: string; password?: string }[];
  }) => Promise<ImportResultRow[] | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('create');
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);

  const reset = () => {
    setMode('create');
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
      const parsed = parseStudentImportCsv(text);
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
      if (mode === 'create' && r.password.trim() && r.password.trim().length < 8) continue;
      validUnique += 1;
    }
    return { dupInFile, validUnique };
  }, [rows, mode]);

  const canSubmit = rows.length > 0 && preview.validUnique > 0 && !importing && !results;

  const handleImport = async () => {
    if (!canSubmit) return;
    const students = rows.map((r) => ({
      email: r.email.trim(),
      firstName: r.firstName.trim() || undefined,
      lastName: r.lastName.trim() || undefined,
      ...(mode === 'create' && r.password.trim() ? { password: r.password.trim() } : {}),
    }));
    const res = await onImport({ mode, students });
    if (res) setResults(res);
  };

  const createdCount = results?.filter((r) => r.ok).length ?? 0;
  const skippedCount = results?.filter((r) => !r.ok && r.skipped).length ?? 0;
  const failedCount = results?.filter((r) => !r.ok && !r.skipped).length ?? 0;
  const generatedPasswords = results?.filter((r) => r.ok && r.generatedPassword) ?? [];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="Import students"
      description="Upload a CSV to create many student accounts at once."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={importing}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results ? (
            <Button onClick={handleImport} disabled={!canSubmit}>
              {importing
                ? 'Importing…'
                : mode === 'invite'
                  ? `Send ${rows.length || ''} invite${rows.length === 1 ? '' : 's'}`.trim()
                  : `Create ${rows.length || ''} student${rows.length === 1 ? '' : 's'}`.trim()}
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
                onClick={() => downloadStudentImportTemplate()}
                disabled={importing}
              >
                Download template
              </Button>
              <span className="text-xs text-slate-500">
                Columns: email, firstName, lastName, password (optional)
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={importing}
                onClick={() => setMode('create')}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'create'
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                Create with password
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => setMode('invite')}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'invite'
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                Email invite
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {mode === 'create'
                ? 'Blank password cells get an auto-generated password emailed to the student.'
                : 'Each student gets an invite email to set their own password.'}
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
              <Button
                type="button"
                variant="secondary"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                Choose CSV file
              </Button>
              {fileName ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {fileName} · {rows.length} student{rows.length === 1 ? '' : 's'}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Max 200 rows per import</p>
              )}
            </div>

            {parseError ? <p className="text-sm text-rose-600 dark:text-rose-400">{parseError}</p> : null}
            {preview.dupInFile > 0 ? (
              <p className="text-sm text-slate-500">
                {preview.dupInFile} duplicate row{preview.dupInFile === 1 ? '' : 's'} in file will be skipped.
                Existing students in the school are also skipped automatically.
              </p>
            ) : rows.length > 0 ? (
              <p className="text-xs text-slate-500">
                Students who already exist are skipped; the rest will still be imported.
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
                      {mode === 'create' ? (
                        <th className="px-2 py-1.5 font-medium">Password</th>
                      ) : null}
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
                        {mode === 'create' ? (
                          <td className="px-2 py-1 text-slate-500">
                            {r.password.trim() ? '••••••••' : 'auto'}
                          </td>
                        ) : null}
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
            {generatedPasswords.length > 0 ? (
              <p className="text-xs text-slate-500">
                Auto-generated passwords were emailed where possible. Keep the list below if email delivery fails.
              </p>
            ) : null}
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                reset();
              }}
            >
              Import another file
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditUserModal({
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
  viewer: AuthUser;
  catalog: { key: string; label: string; description?: string; feature?: string | null; roles?: string[] }[] | undefined;
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
      title="Edit student"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-student-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="edit-student-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Email" htmlFor="edit-student-email" required>
          <Input
            id="edit-student-email"
            required
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="First name" htmlFor="edit-student-first">
            <Input
              id="edit-student-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="edit-student-last">
            <Input
              id="edit-student-last"
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
        <FormField label="New password" htmlFor="edit-student-password" hint="Leave blank to keep current">
          <PasswordInput
            id="edit-student-password"
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

export function UsersPage() {
  const { user } = useAuth();
  const { data: org } = useTenantOrganization();
  const features = resolveOrgFeatures(org);
  const [search, setSearch] = useState('');
  const [classTab, setClassTab] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const isAdmin = user?.hierarchyRole === 'admin';
  const isTeacher = user?.hierarchyRole === 'subordinate';
  const { data, isLoading } = useUsersQuery(
    search,
    user?.id,
    isTeacher ? { limit: 100 } : { page, limit: pageSize }
  );
  const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalogQuery();
  const { createMember, invite, importMembers, updateUser } = useUserMutations();

  const [member, setMember] = useState<MemberForm>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserListRow | null>(null);

  const myPerms = user?.permissions as string[] | undefined;

  const canCreateStudents =
    !!isAdmin && !!myPerms?.includes(PERMISSIONS.USER_CREATE);

  const canEditStudents =
    !!isAdmin &&
    !!myPerms?.some((p) => p === PERMISSIONS.SETTINGS_MANAGE || p === PERMISSIONS.USER_CREATE);

  const canEditPermissionsSection =
    !!user &&
    !catalogLoading &&
    !!catalog?.length &&
    !!isAdmin &&
    !!(myPerms?.includes(PERMISSIONS.SETTINGS_MANAGE) || myPerms?.includes(PERMISSIONS.USER_CREATE));

  const assignableKeySet = useMemo(() => {
    if (!user || !catalog || !isAdmin) return new Set<string>();
    const keys = new Set<string>();
    for (const row of catalog) {
      if (permissionVisibleFor(row, 'user', features)) keys.add(row.key);
    }
    return keys;
  }, [user, catalog, isAdmin, features]);

  const memberRows = useMemo(
    () => (data?.users ?? []).filter((u) => u.hierarchyRole === 'user'),
    [data?.users]
  );

  const classTabs = useMemo(() => {
    if (!isTeacher) return [];
    const byId = new Map<string, { id: string; name: string; academicYear?: string; count: number }>();
    for (const u of memberRows) {
      for (const c of u.classes || []) {
        const existing = byId.get(c.id);
        if (existing) existing.count += 1;
        else byId.set(c.id, { id: c.id, name: c.name, academicYear: c.academicYear, count: 1 });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [isTeacher, memberRows]);

  useEffect(() => {
    if (classTab === 'all') return;
    if (!classTabs.some((c) => c.id === classTab)) setClassTab('all');
  }, [classTab, classTabs]);

  const visibleRows = useMemo(() => {
    if (!isTeacher || classTab === 'all') return memberRows;
    return memberRows.filter((u) => (u.classes || []).some((c) => c.id === classTab));
  }, [isTeacher, classTab, memberRows]);

  const listTotal = isTeacher ? visibleRows.length : (data?.total ?? visibleRows.length);
  const pageCount = Math.max(1, Math.ceil(listTotal / pageSize) || 1);
  const currentPage = Math.min(page, pageCount);
  const pagedRows = isTeacher
    ? visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : visibleRows;
  const rangeFrom = listTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, listTotal);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageTitle = isAdmin ? 'Students' : 'My students';
  const pageDescription = isTeacher
    ? 'Students in your classes. Admin creates accounts and assigns them under Classes.'
    : isAdmin
      ? 'Create or import students here, then assign them to classes under Classes.'
      : 'Students in this school.';

  const runCreateMember = async () => {
    const email = member.email.trim();
    if (!email || !isValidEmail(member.email)) {
      toast.error('Enter a valid email address');
      return;
    }
    const pw = member.password.trim();
    if (!pw) {
      toast.error('Password is required');
      return;
    }
    if (pw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!member.firstName.trim() || !member.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    try {
      const res = (await createMember.mutateAsync({
        email,
        password: pw,
        firstName: member.firstName,
        lastName: member.lastName,
      })) as { user?: { registrationId?: string }; generatedPassword?: string };
      const rid = res?.user?.registrationId;
      const gen = res?.generatedPassword;
      toast.success(
        rid
          ? `Student created · ID ${rid}${gen ? ` · temp password sent by email` : ''}`
          : gen
            ? `User created. Temporary password: ${gen}`
            : 'User created'
      );
      setMember({ email: '', password: '', firstName: '', lastName: '' });
      setAddModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Could not create student');
    }
  };

  const runInviteOnly = async () => {
    const email = member.email.trim();
    if (!email || !isValidEmail(member.email)) {
      toast.error('Enter a valid email address');
      return;
    }
    try {
      await invite.mutateAsync({
        email,
        firstName: member.firstName,
        lastName: member.lastName,
      });
      toast.success('Invitation sent');
      setMember({ email: '', password: '', firstName: '', lastName: '' });
      setAddModalOpen(false);
    } catch {
      toast.error('Invite failed');
    }
  };

  const runImport = async (payload: {
    mode: ImportMode;
    students: { email: string; firstName?: string; lastName?: string; password?: string }[];
  }) => {
    try {
      const data = await importMembers.mutateAsync(payload);
      const skipped = data.skipped ?? 0;
      if (data.failed === 0 && data.created > 0) {
        toast.success(
          skipped > 0
            ? `Created ${data.created}, skipped ${skipped} existing`
            : payload.mode === 'invite'
              ? `Sent ${data.created} invite${data.created === 1 ? '' : 's'}`
              : `Created ${data.created} student${data.created === 1 ? '' : 's'}`
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
      return data.results;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Import failed');
      return null;
    }
  };

  const onSaveEdit = async (body: Record<string, unknown>) => {
    if (!editTarget) return;
    try {
      await updateUser.mutateAsync({ id: editTarget.id, body });
      toast.success('User updated');
      setEditTarget(null);
    } catch {
      toast.error('Could not update user');
    }
  };

  return (
    <div className="ah-page">
      {canCreateStudents && (
        <AddTeamMemberModal
          open={addModalOpen}
          member={member}
          setMember={setMember}
          onClose={() => {
            if (createMember.isPending || invite.isPending) return;
            setMember({ email: '', password: '', firstName: '', lastName: '' });
            setAddModalOpen(false);
          }}
          onCreateUser={runCreateMember}
          onInviteOnly={runInviteOnly}
          createPending={createMember.isPending}
          invitePending={invite.isPending}
        />
      )}

      {canCreateStudents && (
        <ImportStudentsModal
          open={importModalOpen}
          onClose={() => {
            if (importMembers.isPending) return;
            setImportModalOpen(false);
          }}
          importing={importMembers.isPending}
          onImport={runImport}
        />
      )}

      {editTarget && user && canEditStudents && (
        <EditUserModal
          key={editTarget.id}
          open={!!editTarget}
          target={editTarget}
          viewer={user}
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
        eyebrow="People"
        title={pageTitle}
        description={pageDescription}
        actions={
          canCreateStudents ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                Import CSV
              </Button>
              <Button onClick={() => setAddModalOpen(true)}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add student
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="ah-table-wrap">
        {isTeacher && classTabs.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200/80 px-3 pt-3 dark:border-slate-700/80 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setClassTab('all');
                setPage(1);
              }}
              className={clsx(
                'shrink-0 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors',
                classTab === 'all'
                  ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-brand-200 dark:ring-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              All
              <span className="ml-1.5 tabular-nums text-xs opacity-60">{memberRows.length}</span>
            </button>
            {classTabs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setClassTab(c.id);
                  setPage(1);
                }}
                className={clsx(
                  'shrink-0 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  classTab === c.id
                    ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-brand-200 dark:ring-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >
                {c.name}
                <span className="ml-1.5 tabular-nums text-xs opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
        )}

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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={isTeacher ? 'Search by name, email, or class…' : 'Search by email or name…'}
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
          ) : memberRows.length === 0 && !search.trim() ? (
            <EmptyState
              title="No students yet"
              description={
                isTeacher
                  ? 'No students in your classes yet. Ask admin to enroll them under Classes.'
                  : 'Add a student, then assign them to a class.'
              }
              action={
                canCreateStudents ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                      Import CSV
                    </Button>
                    <Button onClick={() => setAddModalOpen(true)}>Add student</Button>
                  </div>
                ) : undefined
              }
            />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              title="No matches"
              description={
                classTab !== 'all'
                  ? 'No students in this class match your search.'
                  : 'Try a different search term.'
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setClassTab('all');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {isTeacher && classTab === 'all' && <th>Classes</th>}
                  <th>Role</th>
                  <th>Status</th>
                  {!isTeacher && <th>Permissions</th>}
                  {canEditStudents && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((u: UserListRow) => {
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
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-brand-600 text-xs font-bold text-white">
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
                      {isTeacher && classTab === 'all' && (
                        <td>
                          {u.classes?.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {u.classes.map((c) => (
                                <Badge key={c.id} tone="brand">
                                  {c.name}
                                  {c.academicYear ? (
                                    <span className="font-normal opacity-70"> · {c.academicYear}</span>
                                  ) : null}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No class</span>
                          )}
                        </td>
                      )}
                      <td>
                        <Badge tone="info">Student</Badge>
                      </td>
                      <td>
                        <Badge tone={u.isActive ? 'success' : 'neutral'}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                          {u.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      {!isTeacher && (
                        <td className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                          <span className="line-clamp-2">{formatPermissionList(u.permissions)}</span>
                        </td>
                      )}
                      {canEditStudents && (
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

        {!isLoading && visibleRows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-700/80">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
                {rangeFrom}–{rangeTo}
              </span>{' '}
              of <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{listTotal}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                Per page
                <Select
                  inputSize="sm"
                  className="w-[4.5rem]"
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </label>
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                {pageWindow(currentPage, pageCount).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? 'page' : undefined}
                    className={clsx(
                      'h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors',
                      n === currentPage
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
