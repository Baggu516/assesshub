import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { AuthUser } from '@/types/user';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { formatPermissionList } from '@/constants/permissionLabels';
import {
  ORG_LEVEL_KEYS,
  usePermissionsCatalogQuery,
  useSubordinatesQuery,
  useUserMutations,
  useUsersQuery,
  type UserListRow,
} from '@/hooks/api/useUsers';
import { isValidEmail } from '@/lib/validation';

type MemberForm = {
  email: string;
  password: string;
  parentUserId: string;
  firstName: string;
  lastName: string;
};

function AddTeamMemberModal({
  open,
  member,
  setMember,
  isAdmin,
  subs,
  subsLoading,
  onClose,
  onCreateUser,
  onInviteOnly,
  createPending,
  invitePending,
}: {
  open: boolean;
  member: MemberForm;
  setMember: Dispatch<SetStateAction<MemberForm>>;
  isAdmin: boolean;
  subs: { id: string; email: string }[];
  subsLoading: boolean;
  onClose: () => void;
  onCreateUser: () => void;
  onInviteOnly: () => void;
  createPending: boolean;
  invitePending: boolean;
}) {
  const canCreateUser = useMemo(() => {
    if (isAdmin && subsLoading) return false;
    return (
      isValidEmail(member.email) &&
      member.password.trim().length >= 8 &&
      (!isAdmin || Boolean(member.parentUserId)) &&
      member.firstName.trim().length > 0 &&
      member.lastName.trim().length > 0
    );
  }, [member, isAdmin, subsLoading]);

  const canInviteOnly = useMemo(() => {
    if (isAdmin && subsLoading) return false;
    return isValidEmail(member.email) && (!isAdmin || Boolean(member.parentUserId));
  }, [member.email, member.parentUserId, isAdmin, subsLoading]);

  const busy = createPending || invitePending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add student"
      description={
        isAdmin
          ? 'Create with a password, or send an email invite. Pick which teacher they report to.'
          : 'Create with a password, or send an email invitation only.'
      }
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
      <div className="space-y-4">
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
        <FormField
          label="Password"
          htmlFor="add-student-password"
          required
          hint="Required to create an account · at least 8 characters"
        >
          <Input
            id="add-student-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={member.password}
            onChange={(e) => setMember((m) => ({ ...m, password: e.target.value }))}
          />
        </FormField>
        {isAdmin && (
          <FormField label="Teacher (parent)" htmlFor="add-student-parent" required>
            <Select
              id="add-student-parent"
              value={member.parentUserId}
              onChange={(e) => setMember((m) => ({ ...m, parentUserId: e.target.value }))}
              required
              disabled={subsLoading}
            >
              <option value="">{subsLoading ? 'Loading teachers…' : 'Select teacher'}</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </Select>
          </FormField>
        )}
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
  viewer,
  subs,
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
  subs: { id: string; email: string }[];
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
  const [parentUserId, setParentUserId] = useState(target.parentUserId ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(target.permissions || []));

  const showParentSelect = viewer.hierarchyRole === 'admin' && target.hierarchyRole === 'user';

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
    if (showParentSelect) body.parentUserId = parentUserId || null;
    if (canEditPermissionsSection && catalog?.length) body.permissions = [...selected];
    await onSave(body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit student"
      description="Update account details and permissions."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-student-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-student-form" onSubmit={handleSubmit} className="space-y-4">
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
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active account
        </label>
        <FormField
          label="New password"
          htmlFor="edit-student-password"
          hint="Leave blank to keep the current password · min. 8 characters when set"
        >
          <Input
            id="edit-student-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </FormField>
        {showParentSelect && (
          <FormField label="Reports to (teacher)" htmlFor="edit-student-parent">
            <Select
              id="edit-student-parent"
              value={parentUserId}
              onChange={(e) => setParentUserId(e.target.value)}
            >
              <option value="">No parent</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {canEditPermissionsSection && catalog && catalog.length > 0 && (
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Permissions
            </h4>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {catalog
                .filter((p) => assignableKeys.has(p.key))
                .map((p) => (
                  <label
                    key={p.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.key)}
                      onChange={() => toggle(p.key)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {p.label}
                      </span>
                      <span className="block font-mono text-xs text-slate-500">{p.key}</span>
                    </span>
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
  const [search, setSearch] = useState('');
  const { data, isLoading } = useUsersQuery(search, user?.id);
  const subs = useSubordinatesQuery(user?.hierarchyRole === 'admin', user?.id);
  const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalogQuery();
  const { createMember, invite, updateUser } = useUserMutations();

  const [member, setMember] = useState<MemberForm>({
    email: '',
    password: '',
    parentUserId: '',
    firstName: '',
    lastName: '',
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserListRow | null>(null);

  const myPerms = user?.permissions as string[] | undefined;

  const canManageListedUsers =
    !!user &&
    !!myPerms?.some((p) => p === PERMISSIONS.SETTINGS_MANAGE || p === PERMISSIONS.USER_CREATE);

  const canEditPermissionsSection =
    !!user &&
    !catalogLoading &&
    !!catalog?.length &&
    (user.hierarchyRole === 'subordinate' ||
      myPerms?.includes(PERMISSIONS.SETTINGS_MANAGE) ||
      (user.hierarchyRole === 'admin' &&
        !!(myPerms?.includes(PERMISSIONS.USER_CREATE) || myPerms?.includes(PERMISSIONS.SUBORDINATE_CREATE))));

  const assignableKeySet = useMemo(() => {
    if (!user || !catalog) return new Set<string>();
    const keys = new Set<string>();
    const my = user.permissions as string[];
    for (const row of catalog) {
      const key = row.key;
      if (user.hierarchyRole === 'subordinate') {
        if (my.includes(key) && !ORG_LEVEL_KEYS.has(key)) keys.add(key);
      } else if (user.hierarchyRole === 'admin') {
        if (my.includes(PERMISSIONS.SETTINGS_MANAGE)) keys.add(key);
        else if (my.includes(key)) keys.add(key);
      }
    }
    return keys;
  }, [user, catalog]);

  /** This screen is only for line members (`user`). Never show admins/subordinates even if API/cache is stale. */
  const memberRows = useMemo(
    () => (data?.users ?? []).filter((u) => u.hierarchyRole === 'user'),
    [data?.users]
  );

  const pageTitle = user?.hierarchyRole === 'admin' ? 'Students' : 'My students';
  const pageDescription =
    user?.hierarchyRole === 'subordinate'
      ? 'Students you manage — only your direct reports are listed.'
      : user?.hierarchyRole === 'admin'
        ? 'All students in this school. Create them here, then assign them to a class under Classes.'
        : 'Create people, send invitations, and manage access.';

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
    if (user?.hierarchyRole === 'admin' && !member.parentUserId) {
      toast.error('Select a subordinate lead');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        email,
        password: pw,
        firstName: member.firstName,
        lastName: member.lastName,
      };
      if (user?.hierarchyRole === 'admin') {
        payload.parentUserId = member.parentUserId;
      }
      const res = (await createMember.mutateAsync(payload)) as {
        user?: unknown;
        generatedPassword?: string;
      };
      const gen = res?.generatedPassword;
      if (gen) toast.success(`User created. Temporary password: ${gen}`);
      else toast.success('User created');
      setMember({ email: '', password: '', parentUserId: '', firstName: '', lastName: '' });
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
    if (user?.hierarchyRole === 'admin' && !member.parentUserId) {
      toast.error('Select a subordinate lead');
      return;
    }
    try {
      await invite.mutateAsync({
        email,
        firstName: member.firstName,
        lastName: member.lastName,
        ...(user?.hierarchyRole === 'admin' ? { parentUserId: member.parentUserId } : {}),
      });
      toast.success('Invitation sent');
      setMember({ email: '', password: '', parentUserId: '', firstName: '', lastName: '' });
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
      {canManageListedUsers && user && (
        <AddTeamMemberModal
          open={addModalOpen}
          member={member}
          setMember={setMember}
          isAdmin={user.hierarchyRole === 'admin'}
          subs={(subs.data || []) as { id: string; email: string }[]}
          subsLoading={user.hierarchyRole === 'admin' && subs.isLoading}
          onClose={() => setAddModalOpen(false)}
          onCreateUser={runCreateMember}
          onInviteOnly={runInviteOnly}
          createPending={createMember.isPending}
          invitePending={invite.isPending}
        />
      )}

      {editTarget && user && (
        <EditUserModal
          key={editTarget.id}
          open={!!editTarget}
          target={editTarget}
          viewer={user}
          subs={(subs.data || []) as { id: string; email: string }[]}
          catalog={catalog}
          assignableKeys={assignableKeySet}
          canEditPermissionsSection={canEditPermissionsSection}
          saving={updateUser.isPending}
          onClose={() => setEditTarget(null)}
          onSave={onSaveEdit}
        />
      )}

      <PageHeader
        eyebrow="People"
        title={pageTitle}
        description={pageDescription}
        actions={
          canManageListedUsers ? (
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
          ) : memberRows.length === 0 && !search.trim() ? (
            <EmptyState
              title="No students yet"
              description="Add a student to get started."
              action={
                canManageListedUsers ? (
                  <Button onClick={() => setAddModalOpen(true)}>Add student</Button>
                ) : undefined
              }
            />
          ) : memberRows.length === 0 ? (
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
                  <th>Student</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  {canManageListedUsers && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {memberRows.map((u: UserListRow) => {
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
                          </div>
                        </div>
                      </td>
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
                      <td className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                        <span className="line-clamp-2">{formatPermissionList(u.permissions)}</span>
                      </td>
                      {canManageListedUsers && (
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
