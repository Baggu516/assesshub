import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformApi } from '@/lib/platformApi';
import { Card } from '@/components/ui/Card';
import type { AuthUser } from '@/types/user';

type PlatformOrg = {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const emptyCreateForm = {
  name: '',
  subdomain: '',
  isActive: true,
  adminEmail: '',
  adminPassword: '',
  firstName: '',
  lastName: '',
};

type CreateOrgResponse = {
  organization: PlatformOrg;
  adminProvisioned: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  user?: AuthUser;
};

function EditOrganizationModal({
  org,
  open,
  onClose,
  onSave,
  isPending,
}: {
  org: PlatformOrg | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, body: { name: string; isActive: boolean }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setIsActive(org.isActive);
    }
  }, [org, open]);

  if (!open || !org) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit organization</h2>
            <p className="text-xs text-slate-500 mt-1">Subdomain is fixed after creation (database name).</p>
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
            const nextName = name.trim();
            if (!nextName) return;
            onSave(org.id, { name: nextName, isActive });
            onClose();
          }}
        >
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Subdomain
            <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300">
              {org.subdomain}
            </div>
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Organization name
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (tenant can sign in)
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
              disabled={isPending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function CreateOrganizationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyCreateForm);

  useEffect(() => {
    if (!open) setForm(emptyCreateForm);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        subdomain: form.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        isActive: form.isActive,
      };
      if (form.adminEmail.trim() && form.adminPassword) {
        body.adminEmail = form.adminEmail.trim().toLowerCase();
        body.adminPassword = form.adminPassword;
        if (form.firstName.trim()) body.firstName = form.firstName.trim();
        if (form.lastName.trim()) body.lastName = form.lastName.trim();
      }
      const { data } = await platformApi.post<CreateOrgResponse>('/platform/organizations', body);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });

      toast.success(
        data.adminProvisioned
          ? `Organization created — tenant admin can sign in at app login (subdomain: ${data.organization.subdomain})`
          : 'Organization created (add users via tenant app or invite)'
      );
      setForm(emptyCreateForm);
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not create organization');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create organization</h2>
            <p className="text-xs text-slate-500 mt-1">
              Registers a tenant in the registry. Optionally create the first admin in that tenant&apos;s database.
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
            createMutation.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Organization name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Subdomain
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                value={form.subdomain}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  }))
                }
                placeholder="acme"
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
            Active (tenant can sign in)
          </label>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Optional first admin</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                Admin email
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@company.com"
                />
              </label>
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                Admin password
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  placeholder="min 8 characters"
                  autoComplete="new-password"
                />
              </label>
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
            <p className="text-xs text-slate-500 mt-2">
              Leave admin fields empty if you only want the registry row (provision DB later via tenant signup).
            </p>
          </div>

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
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function PlatformOrganizationsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PlatformOrg | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-organizations'],
    queryFn: async () => {
      const { data: res } = await platformApi.get<{ organizations: PlatformOrg[] }>(
        '/platform/organizations'
      );
      return res.organizations;
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { name?: string; isActive?: boolean } }) => {
      const { data: res } = await platformApi.patch<{ organization: PlatformOrg }>(
        `/platform/organizations/${id}`,
        body
      );
      return res.organization;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Saved');
    },
    onError: () => toast.error('Update failed'),
  });

  const saveOrg = (id: string, body: { name: string; isActive: boolean }) => {
    patchMutation.mutate({
      id,
      body: { name: body.name, isActive: body.isActive },
    });
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
          ? 'Platform API is disabled on the server (set PLATFORM_ADMIN_API_KEY).'
          : msg || 'Could not load organizations.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditOrganizationModal
        org={editingOrg}
        open={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        onSave={saveOrg}
        isPending={patchMutation.isPending}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Organizations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage tenants in the registry. Use <span className="font-medium">Edit</span> to rename
            or suspend an organization (subdomain cannot change).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 shrink-0"
        >
          Create organization
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subdomain</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Created</th>
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
                    No organizations yet. Create one above.
                  </td>
                </tr>
              ) : (
                data.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{org.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{org.subdomain}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          org.isActive
                            ? 'inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400'
                            : 'inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300'
                        }
                      >
                        <span
                          className={
                            org.isActive
                              ? 'h-2 w-2 rounded-full bg-emerald-500'
                              : 'h-2 w-2 rounded-full bg-amber-500'
                          }
                          aria-hidden
                        />
                        {org.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {org.createdAt ? new Date(org.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingOrg(org)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      >
                        Edit
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
