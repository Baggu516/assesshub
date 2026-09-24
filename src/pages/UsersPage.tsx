import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
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
import { PERMISSIONS } from '@/constants/permissions';
import { formatPermissionList, permissionVisibleFor } from '@/constants/permissionLabels';
import { resolveOrgFeatures } from '@/lib/sessionCache';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import {
  usePermissionsCatalogQuery,
  useUserMutations,
  useUsersQuery,
  type UserListRow,
} from '@/hooks/api/useUsers';
import { isValidEmail } from '@/lib/validation';

type MemberForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

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
  const isAdmin = user?.hierarchyRole === 'admin';
  const isTeacher = user?.hierarchyRole === 'subordinate';
  const { data, isLoading } = useUsersQuery(search, user?.id, isTeacher ? { limit: 100 } : undefined);
  const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalogQuery();
  const { createMember, invite, updateUser } = useUserMutations();

  const [member, setMember] = useState<MemberForm>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
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

  const pageTitle = isAdmin ? 'Students' : 'My students';
  const pageDescription = isTeacher
    ? 'Students in your classes. Admin creates accounts and assigns them under Classes.'
    : isAdmin
      ? 'Create students here, then assign teachers and students to classes under Classes.'
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
            <Button onClick={() => setAddModalOpen(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add student
            </Button>
          ) : undefined
        }
      />

      <div className="ah-table-wrap">
        {isTeacher && classTabs.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200/80 px-3 pt-3 dark:border-slate-700/80 sm:px-4">
            <button
              type="button"
              onClick={() => setClassTab('all')}
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
                onClick={() => setClassTab(c.id)}
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
              onChange={(e) => setSearch(e.target.value)}
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
                  <Button onClick={() => setAddModalOpen(true)}>Add student</Button>
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
                {visibleRows.map((u: UserListRow) => {
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
      </div>
    </div>
  );
}
