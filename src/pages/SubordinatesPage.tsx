import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/permissions';
import { formatPermissionList } from '@/constants/permissionLabels';
import {
  usePermissionsCatalogQuery,
  useSubordinatesQuery,
  useUserMutations,
  type UserListRow,
} from '@/hooks/api/useUsers';
import { isValidEmail } from '@/lib/validation';

function InviteSubordinateModal({
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
}: {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Add teacher</h3>
            <p className="text-xs text-slate-500 mt-1">
              All fields required: valid email, password (min. 8 characters), first and last name.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm shrink-0">
            Close
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canCreate || saving) return;
            onSubmit(e);
          }}
          className="mt-4 grid md:grid-cols-2 gap-3"
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email *"
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm md:col-span-2"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Password * (min 8 characters)"
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm md:col-span-2"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
          />
          <input
            placeholder="First name *"
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          />
          <input
            placeholder="Last name *"
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          />
          <button
            type="submit"
            className="md:col-span-2 rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canCreate || saving}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </form>
      </Card>
    </div>
  );
}

function SubordinateEditModal({
  target,
  catalog,
  assignableKeys,
  canEditPermissionsSection,
  onClose,
  onSave,
  saving,
}: {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Edit subordinate</h3>
            <p className="text-xs text-slate-500 mt-1 capitalize">Subordinate lead</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
              <input
                required
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
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
            </div>
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

export function SubordinatesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = useSubordinatesQuery(true, user?.id);
  const { createSubordinate, updateUser } = useUserMutations();
  const { data: catalog, isLoading: catalogLoading } = usePermissionsCatalogQuery();
  const [editTarget, setEditTarget] = useState<UserListRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const myPerms = user?.permissions as string[] | undefined;

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
    const my = user.permissions as string[];
    for (const row of catalog) {
      const key = row.key;
      if (my.includes(PERMISSIONS.SETTINGS_MANAGE)) keys.add(key);
      else if (my.includes(key)) keys.add(key);
    }
    return keys;
  }, [user, catalog]);

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
      await createSubordinate.mutateAsync({
        ...form,
        email,
        password: pw,
      });
      toast.success('Subordinate created');
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

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Teachers</h1>
        <p className="text-sm text-slate-500 mt-1">Team leads reporting to the administrator.</p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Teachers</h2>
            <p className="text-xs text-slate-500 mt-1">Add a team lead reporting to the administrator.</p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            disabled={!canOpenEdit}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </Card>
      <Card>
        <div className="flex gap-2 mb-4">
          <input
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm flex-1"
            placeholder="Search teachers"
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
                {canOpenEdit && <th className="py-2"> </th>}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={canOpenEdit ? 5 : 4}>
                      <Skeleton className="h-6 my-2" />
                    </td>
                  </tr>
                ))}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={canOpenEdit ? 5 : 4} className="py-6 text-center text-sm text-slate-500">
                    No teachers yet.
                  </td>
                </tr>
              )}
              {!isLoading &&
                (data?.length ?? 0) > 0 &&
                filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={canOpenEdit ? 5 : 4} className="py-6 text-center text-sm text-slate-500">
                      No matches for your search.
                    </td>
                  </tr>
                )}
              {!isLoading &&
                filteredRows.map((u: UserListRow) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">Teacher</td>
                    <td className="py-2">{u.isActive ? 'Active' : 'Disabled'}</td>
                    <td className="py-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="line-clamp-2">{formatPermissionList(u.permissions)}</span>
                    </td>
                    {canOpenEdit && (
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
        {!canOpenEdit && (
          <p className="mt-3 text-xs text-slate-500">You need permission to manage users to edit subordinates.</p>
        )}
      </Card>

      {inviteOpen && canOpenEdit && (
        <InviteSubordinateModal
          form={form}
          setForm={setForm}
          saving={createSubordinate.isPending}
          onClose={() => {
            setInviteOpen(false);
          }}
          onSubmit={onSubmitInvite}
        />
      )}

      {editTarget && canOpenEdit && (
        <SubordinateEditModal
          key={editTarget.id}
          target={editTarget}
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
