import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { platformApi } from '@/lib/platformApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add platform user"
      description="Registry account for /platform — separate from tenant app users."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </>
      }
    >
      <form
        id="create-user-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="ah-label">
          Email
          <Input
            required
            type="email"
            autoComplete="off"
            className="mt-1.5"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="ah-label">
          Password
          <Input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className="mt-1.5"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="ah-label">
            First name
            <Input
              className="mt-1.5"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </label>
          <label className="ah-label">
            Last name
            <Input
              className="mt-1.5"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
      </form>
    </Modal>
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

  return (
    <Modal
      open={open && !!user}
      onClose={onClose}
      title="Edit platform user"
      description="Leave password blank to keep the current password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      {user && (
        <form
          id="edit-user-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="ah-label">
            Email
            <Input
              required
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="ah-label">
            New password (optional)
            <Input
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="ah-label">
              First name
              <Input
                className="mt-1.5"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="ah-label">
              Last name
              <Input
                className="mt-1.5"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </form>
      )}
    </Modal>
  );
}

export function PlatformUsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformRegistryUser | null>(null);
  const [query, setQuery] = useState('');

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
    if (!window.confirm(`Delete platform user ${u.email}? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate(u.id);
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      return u.email.toLowerCase().includes(q) || name.includes(q);
    });
  }, [data, query]);

  if (error) {
    const msg =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string }; status?: number } }).response?.data?.error
        : undefined;
    const code = (error as { response?: { status?: number } }).response?.status;
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {code === 503
          ? 'Platform API is disabled on the server (configure PLATFORM_ADMIN_API_KEY or env login).'
          : msg || 'Could not load platform users.'}
      </div>
    );
  }

  return (
    <div className="ah-page">
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} />

      <PageHeader
        eyebrow="Operators"
        title="Users"
        description="Platform operators for this console. They sign in at /platform/login. Tenant users are managed separately."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add user
          </Button>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              title="No platform users yet"
              description="Add an operator, or sign in with PLATFORM_ADMIN_EMAIL from .env."
              action={<Button onClick={() => setCreateOpen(true)}>Add user</Button>}
            />
          ) : !filtered.length ? (
            <EmptyState
              title="No matches"
              description="Try a different search term."
              action={
                <Button variant="secondary" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <table className="ah-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
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
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-bold text-white">
                            {initials}
                          </div>
                          <code className="truncate font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                            {u.email}
                          </code>
                        </div>
                      </td>
                      <td className="text-slate-700 dark:text-slate-300">{name || '—'}</td>
                      <td>
                        <Badge tone={u.isActive ? 'success' : 'neutral'}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                          {u.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {u.updatedAt
                          ? new Date(u.updatedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <div className="inline-flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditing(u)}>
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onDelete(u)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
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
