import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { AuthUser } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Add student</h3>
            <p className="text-xs text-slate-500 mt-1">
              Fill all fields with a valid email; password min. 8 characters to create. Invite only needs a valid email
              {isAdmin ? ' and parent lead.' : '.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm shrink-0">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            type="email"
            placeholder="Email *"
            inputMode="email"
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={member.email}
            onChange={(e) => setMember((m) => ({ ...m, email: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Password * (min 8 characters — Create user)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={member.password}
            onChange={(e) => setMember((m) => ({ ...m, password: e.target.value }))}
            autoComplete="new-password"
          />
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Subordinate lead (parent) *
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={member.parentUserId}
                onChange={(e) => setMember((m) => ({ ...m, parentUserId: e.target.value }))}
                required={isAdmin}
                disabled={subsLoading}
              >
                <option value="">{subsLoading ? 'Loading leads…' : 'Select subordinate lead (parent)'}</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <input
              placeholder="First name *"
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={member.firstName}
              onChange={(e) => setMember((m) => ({ ...m, firstName: e.target.value }))}
            />
            <input
              placeholder="Last name *"
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={member.lastName}
              onChange={(e) => setMember((m) => ({ ...m, lastName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onCreateUser}
              disabled={!canCreateUser || createPending || invitePending}
              className="rounded-lg bg-indigo-600 text-white text-sm px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPending ? 'Creating…' : 'Create user'}
            </button>
            <button
              type="button"
              onClick={onInviteOnly}
              disabled={!canInviteOnly || createPending || invitePending}
              className="rounded-lg border border-slate-200 dark:border-slate-700 text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {invitePending ? 'Sending…' : 'Email invite only'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EditUserModal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Edit user</h3>
            <p className="text-xs text-slate-500 mt-1 capitalize">{target.hierarchyRole}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <div className="grid md:grid-cols-2 gap-3">
              <input
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active account
            </label>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                New password (optional)
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                placeholder="Leave blank to keep current password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum 8 characters when set.</p>
            </div>
            {showParentSelect && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Reports to (subordinate lead)
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  value={parentUserId}
                  onChange={(e) => setParentUserId(e.target.value)}
                >
                  <option value="">No parent</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {canEditPermissionsSection && catalog && catalog.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                Permissions
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {catalog
                  .filter((p) => assignableKeys.has(p.key))
                  .map((p) => (
                    <label
                      key={p.key}
                      className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.key)}
                        onChange={() => toggle(p.key)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.label}</span>
                        <span className="block text-xs text-slate-500 font-mono">{p.key}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Card>
    </div>
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
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {user?.hierarchyRole === 'admin' ? 'Students' : 'My students'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.hierarchyRole === 'subordinate'
            ? 'Students you manage — only your direct reports are listed.'
            : user?.hierarchyRole === 'admin'
              ? 'All students in this school. Create them here, then assign them to a class under Classes.'
              : 'Create people, send invitations, and manage access.'}
        </p>
      </div>

      {canManageListedUsers && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Students</h2>
              <p className="text-xs text-slate-500 mt-1">
                {user?.hierarchyRole === 'admin'
                  ? 'Add a student with a password, or send an email invitation. Pick which teacher they report to.'
                  : 'Add someone with a password, or send an email invitation only.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium"
            >
              Add
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex gap-2 mb-4">
          <input
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm flex-1"
            placeholder="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Permissions</th>
                {canManageListedUsers && <th className="py-2"> </th>}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={canManageListedUsers ? 5 : 4}>
                      <Skeleton className="h-6 my-2" />
                    </td>
                  </tr>
                ))}
              {!isLoading && memberRows.length === 0 && (
                <tr>
                  <td colSpan={canManageListedUsers ? 5 : 4} className="py-6 text-center text-sm text-slate-500">
                    No students yet.
                  </td>
                </tr>
              )}
              {!isLoading &&
                memberRows.map((u: UserListRow) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">Student</td>
                    <td className="py-2">{u.isActive ? 'Active' : 'Disabled'}</td>
                    <td className="py-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="line-clamp-2">{formatPermissionList(u.permissions)}</span>
                    </td>
                    {canManageListedUsers && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditTarget(u)}
                          className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {addModalOpen && canManageListedUsers && user && (
        <AddTeamMemberModal
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
    </div>
  );
}
