import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformApi } from '@/lib/platformApi';
import { Card } from '@/components/ui/Card';

export type PlatformRegistryUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const emptyCreate = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  isActive: true,
};

function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyCreate);

  useEffect(() => {
    if (!open) setForm(emptyCreate);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await platformApi.post<{ user: PlatformRegistryUser }>('/platform/users', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        isActive: form.isActive,
      });
      return data.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('User created');
      setForm(emptyCreate);
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not create user');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add platform user</h2>
            <p className="text-xs text-slate-500 mt-1">
              Registry account for /platform (separate from tenant app users).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Email
            <input
              required
              type="email"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Password
            <input
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              First name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              Last name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
            >
              {mutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditUserModal({
  user,
  open,
  onClose,
}: {
  user: PlatformRegistryUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user && open) {
      setEmail(user.email);
      setPassword('');
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setIsActive(user.isActive);
    }
  }, [user, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const body: Record<string, unknown> = {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isActive,
      };
      if (password.trim()) {
        body.password = password;
      }
      const { data } = await platformApi.patch<{ user: PlatformRegistryUser }>(
        `/platform/users/${user.id}`,
        body
      );
      return data.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('User updated');
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not update user');
    },
  });

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit platform user</h2>
            <p className="text-xs text-slate-500 mt-1">Leave password blank to keep the current password.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Email
            <input
              required
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            New password (optional)
            <input
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              First name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              Last name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function PlatformUsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformRegistryUser | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-users'],
    queryFn: async () => {
      const { data: res } = await platformApi.get<{ users: PlatformRegistryUser[] }>('/platform/users');
      return res.users;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await platformApi.delete(`/platform/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      toast.success('User deleted');
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not delete user');
    },
  });

  const onDelete = (u: PlatformRegistryUser) => {
    if (
      !window.confirm(
        `Delete platform user ${u.email}? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteMutation.mutate(u.id);
  };

  if (error) {
    const msg =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string }; status?: number } }).response?.data?.error
        : undefined;
    const code = (error as { response?: { status?: number } }).response?.status;
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        {code === 503
          ? 'Platform API is disabled on the server (configure PLATFORM_ADMIN_API_KEY or env login).'
          : msg || 'Could not load platform users.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform operators for this console. They sign in at{' '}
            <span className="font-mono text-xs">/platform/login</span> with email and password. Tenant app users
            are managed separately after choosing an organization subdomain.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 shrink-0"
        >
          Add user
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : !data?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No platform users yet. Add one above, or sign in with{' '}
                    <span className="font-mono text-xs">PLATFORM_ADMIN_EMAIL</span> from{' '}
                    <span className="font-mono text-xs">.env</span>.
                  </td>
                </tr>
              ) : (
                data.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">{u.email}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.isActive
                            ? 'inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1.5 text-slate-500'
                        }
                      >
                        <span
                          className={
                            u.isActive ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-slate-400'
                          }
                          aria-hidden
                        />
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {u.updatedAt ? new Date(u.updatedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(u)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
