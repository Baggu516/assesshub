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
import { Toggle } from '@/components/ui/Toggle';
import type { AuthUser } from '@/types/user';

type OrgPlan = 'assessments_only' | 'ai_dashboard';

type PlatformOrg = {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  plan?: OrgPlan;
  createdAt?: string;
  updatedAt?: string;
};

const emptyCreateForm = {
  name: '',
  subdomain: '',
  isActive: true,
  plan: 'assessments_only' as OrgPlan,
  adminEmail: '',
  adminPassword: '',
  firstName: '',
  lastName: '',
};

function PlanPicker({
  value,
  onChange,
}: {
  value: OrgPlan;
  onChange: (plan: OrgPlan) => void;
}) {
  const aiEnabled = value === 'ai_dashboard';

  return (
    <div>
      <p className="ah-label mb-2">Subscription</p>
      <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex cursor-not-allowed items-start gap-2.5 opacity-80">
          <input
            type="checkbox"
            checked
            disabled
            readOnly
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
              Assessments
            </span>
            <span className="block text-xs text-slate-500">Always included · cannot be turned off</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={aiEnabled}
            onChange={(e) => onChange(e.target.checked ? 'ai_dashboard' : 'assessments_only')}
          />
          <span>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
              AI on dashboard
            </span>
            <span className="block text-xs text-slate-500">
              Dashboard AI chat and knowledge base
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function planLabel(plan?: OrgPlan) {
  return plan === 'ai_dashboard' ? 'AI dashboard' : 'Assessments';
}

type CreateOrgResponse = {
  organization: PlatformOrg;
  adminProvisioned: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  user?: AuthUser;
};

function orgInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarTone(name: string) {
  const tones = [
    'from-brand-500 to-cyan-600',
    'from-sky-500 to-blue-600',
    'from-teal-500 to-emerald-600',
    'from-cyan-500 to-teal-700',
    'from-slate-500 to-slate-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[hash];
}

function slugifySubdomain(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
  onSave: (id: string, body: { name: string; isActive: boolean; plan: OrgPlan }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [plan, setPlan] = useState<OrgPlan>('ai_dashboard');

  useEffect(() => {
    if (org) {
      setName(org.name);
      setIsActive(org.isActive);
      setPlan(org.plan === 'ai_dashboard' ? 'ai_dashboard' : 'assessments_only');
    }
  }, [org, open]);

  return (
    <Modal
      open={open && !!org}
      onClose={onClose}
      title="Edit organization"
      description="Rename, change subscription, or suspend this tenant. Subdomain cannot change."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-org-form" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {org && (
        <form
          id="edit-org-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const nextName = name.trim();
            if (!nextName) return;
            onSave(org.id, { name: nextName, isActive, plan });
            onClose();
          }}
        >
          <div>
            <p className="ah-label">Subdomain</p>
            <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">{org.subdomain}</p>
            <p className="mt-0.5 text-xs text-slate-400">Locked after creation</p>
          </div>

          <div>
            <label htmlFor="edit-org-name" className="ah-label">
              Name
            </label>
            <Input
              id="edit-org-name"
              required
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <PlanPicker value={plan} onChange={setPlan} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Active</p>
              <p className="text-xs text-slate-500">Allow this tenant to sign in</p>
            </div>
            <Toggle checked={isActive} onChange={setIsActive} aria-label="Active" />
          </div>
        </form>
      )}
    </Modal>
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
  const [subdomainTouched, setSubdomainTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyCreateForm);
      setSubdomainTouched(false);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        subdomain: form.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        isActive: form.isActive,
        plan: form.plan,
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

  const onNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      name: value,
      subdomain: subdomainTouched ? f.subdomain : slugifySubdomain(value),
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Create organization"
      description="Registers a tenant in the registry. Optionally create the first admin in that tenant's database."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-org-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="create-org-form"
        className="space-y-4"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="create-org-name" className="ah-label">
              Organization name
            </label>
            <Input
              id="create-org-name"
              required
              className="mt-1.5"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Acme University"
              autoComplete="organization"
            />
          </div>
          <div>
            <label htmlFor="create-org-subdomain" className="ah-label">
              Subdomain
            </label>
            <Input
              id="create-org-subdomain"
              required
              className="mt-1.5"
              value={form.subdomain}
              onChange={(e) => {
                setSubdomainTouched(true);
                setForm((f) => ({
                  ...f,
                  subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                }));
              }}
              placeholder="acme"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active (tenant can sign in)
        </label>

        <PlanPicker value={form.plan} onChange={(plan) => setForm((f) => ({ ...f, plan }))} />

        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <p className="mb-3 text-xs font-medium text-slate-600 dark:text-slate-400">Optional first admin</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="create-org-admin-email" className="ah-label">
                Admin email
              </label>
              <Input
                id="create-org-admin-email"
                type="email"
                className="mt-1.5"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                placeholder="admin@company.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="create-org-admin-password" className="ah-label">
                Admin password
              </label>
              <Input
                id="create-org-admin-password"
                type="password"
                className="mt-1.5"
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                placeholder="min 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="create-org-first-name" className="ah-label">
                First name
              </label>
              <Input
                id="create-org-first-name"
                className="mt-1.5"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="create-org-last-name" className="ah-label">
                Last name
              </label>
              <Input
                id="create-org-last-name"
                className="mt-1.5"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Leave admin fields empty if you only want the registry row.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export function PlatformOrganizationsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PlatformOrg | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

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
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { name?: string; isActive?: boolean; plan?: OrgPlan };
    }) => {
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

  const saveOrg = (id: string, body: { name: string; isActive: boolean; plan: OrgPlan }) => {
    patchMutation.mutate({
      id,
      body: { name: body.name, isActive: body.isActive, plan: body.plan },
    });
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((org) => {
      if (statusFilter === 'active' && !org.isActive) return false;
      if (statusFilter === 'suspended' && org.isActive) return false;
      if (!q) return true;
      return org.name.toLowerCase().includes(q) || org.subdomain.toLowerCase().includes(q);
    });
  }, [data, query, statusFilter]);

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      active: list.filter((o) => o.isActive).length,
      suspended: list.filter((o) => !o.isActive).length,
    };
  }, [data]);

  if (error) {
    const msg =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string }; status?: number } }).response?.data?.error
        : undefined;
    const code = (error as { response?: { status?: number } }).response?.status;
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {code === 503
          ? 'Platform API is disabled on the server (set PLATFORM_ADMIN_API_KEY).'
          : msg || 'Could not load organizations.'}
      </div>
    );
  }

  return (
    <div className="ah-page">
      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditOrganizationModal
        org={editingOrg}
        open={!!editingOrg}
        onClose={() => setEditingOrg(null)}
        onSave={saveOrg}
        isPending={patchMutation.isPending}
      />

      <PageHeader
        eyebrow="Tenant registry"
        title="Organizations"
        description="Create and manage tenants. Edit to rename or suspend — subdomain cannot change after creation."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create organization
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total', value: counts.total, tone: 'text-slate-900 dark:text-white' },
          { label: 'Active', value: counts.active, tone: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Suspended', value: counts.suspended, tone: 'text-amber-700 dark:text-amber-300' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-soft backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/50"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {stat.label}
            </p>
            <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${stat.tone}`}>
              {isLoading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="ah-table-wrap">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-slate-700/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative max-w-md flex-1">
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
              placeholder="Search by name or subdomain…"
              className="pl-10"
              inputSize="sm"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-950/50">
            {(
              [
                ['all', 'All'],
                ['active', 'Active'],
                ['suspended', 'Suspended'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={
                  statusFilter === key
                    ? 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }
              >
                {label}
              </button>
            ))}
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
                  <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.length ? (
            <EmptyState
              title="No organizations yet"
              description="Create your first tenant to start provisioning databases and inviting admins."
              action={
                <Button onClick={() => setCreateOpen(true)}>Create organization</Button>
              }
            />
          ) : !filtered.length ? (
            <EmptyState
              title="No matches"
              description="Try a different search or clear the status filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
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
                  <th>Organization</th>
                  <th>Subdomain</th>
                  <th>Subscription</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-sm ${avatarTone(org.name)}`}
                        >
                          {orgInitials(org.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">{org.name}</p>
                          <p className="truncate text-xs text-slate-400">ID · {org.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {org.subdomain}
                      </code>
                    </td>
                    <td>
                      <Badge tone={org.plan === 'ai_dashboard' ? 'brand' : 'neutral'}>
                        {planLabel(org.plan)}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={org.isActive ? 'success' : 'warning'}>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${org.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        />
                        {org.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-slate-500">
                      {org.createdAt
                        ? new Date(org.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="text-right">
                      <Button variant="secondary" size="sm" onClick={() => setEditingOrg(org)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!!filtered.length && (
          <div className="border-t border-slate-200/80 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/80">
            Showing {filtered.length} of {counts.total} organization{counts.total === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  );
}
