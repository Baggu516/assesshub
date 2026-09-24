import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { platformApi } from '@/lib/platformApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Toggle } from '@/components/ui/Toggle';
import type { AuthUser } from '@/types/user';
import { resolveOrgFeatures, type OrgFeatures, type OrgPlan } from '@/lib/sessionCache';

type OrgPoc = {
  name: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
};

type PlatformOrg = {
  id: string;
  name: string;
  subdomain: string;
  dbName?: string | null;
  isActive: boolean;
  logoUrl?: string | null;
  tagline?: string | null;
  plan?: OrgPlan;
  features?: OrgFeatures;
  poc?: OrgPoc | null;
  createdAt?: string;
  updatedAt?: string;
};

const defaultFeatures: OrgFeatures = {
  aiDashboard: false,
  aiAssessmentCreate: false,
  worksheets: false,
  assessments: false,
  onlineExams: false,
};

const emptyCreateForm = {
  name: '',
  subdomain: '',
  tagline: '',
  isActive: true,
  features: { ...defaultFeatures },
  adminEmail: '',
  adminPassword: '',
  firstName: '',
  lastName: '',
};

function resolveFeatures(org?: Pick<PlatformOrg, 'plan' | 'features'> | null): OrgFeatures {
  return resolveOrgFeatures(org);
}

function PlanPicker({
  value,
  onChange,
}: {
  value: OrgFeatures;
  onChange: (features: OrgFeatures) => void;
}) {
  const rows: { key: keyof OrgFeatures; title: string }[] = [
    { key: 'aiDashboard', title: 'AI chat on dashboard' },
    { key: 'aiAssessmentCreate', title: 'AI for assessments and online exams' },
    { key: 'worksheets', title: 'Worksheets' },
    { key: 'assessments', title: 'Assessments' },
    { key: 'onlineExams', title: 'Online exams' },
  ];

  return (
    <div>
      <p className="ah-label mb-1.5">Subscription</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {rows.map((row, index) => {
          const checked = value[row.key] === true;
          return (
            <div
              key={row.key}
              className={clsx(
                'flex items-center justify-between gap-3 px-3 py-2',
                index > 0 && 'border-t border-slate-100 dark:border-slate-800'
              )}
            >
              <p className="text-sm text-slate-800 dark:text-slate-100">{row.title}</p>
              <Toggle
                checked={checked}
                onChange={(next) =>
                  onChange({
                    ...value,
                    [row.key]: next,
                  })
                }
                aria-label={row.title}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function subscriptionSummary(org: PlatformOrg) {
  const features = resolveFeatures(org);
  const extras: string[] = [];
  if (features.aiDashboard) extras.push('AI chat');
  if (features.aiAssessmentCreate) extras.push('AI create');
  if (features.worksheets) extras.push('Worksheets');
  if (features.assessments) extras.push('Assessments');
  if (features.onlineExams) extras.push('Online exams');
  if (!extras.length) return { label: 'None', tone: 'neutral' as const };
  if (extras.length > 2) return { label: `${extras.length} features`, tone: 'brand' as const };
  return { label: extras.join(' · '), tone: 'brand' as const };
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

type UploadedLogo = { logoUrl: string; logoStoragePath: string };

type OrgSaveBody = {
  name: string;
  isActive: boolean;
  features: OrgFeatures;
  tagline: string;
  clearLogo?: boolean;
  logoUrl?: string;
  logoStoragePath?: string;
};

async function uploadClientLogo(file: File, subdomain: string) {
  const fd = new FormData();
  fd.append('logo', file);
  if (subdomain) fd.append('subdomain', subdomain);
  const { data } = await platformApi.post<UploadedLogo>('/platform/organizations/logo', fd);
  return data;
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
  onSave: (id: string, body: OrgSaveBody) => Promise<unknown>;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<OrgFeatures>(defaultFeatures);
  const [uploadedLogo, setUploadedLogo] = useState<UploadedLogo | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [clearLogo, setClearLogo] = useState(false);
  const [logoInputKey, setLogoInputKey] = useState(0);

  const { data: detail, isLoading: pocLoading } = useQuery({
    queryKey: ['platform-organization', org?.id],
    queryFn: async () => {
      const { data: res } = await platformApi.get<{ organization: PlatformOrg }>(
        `/platform/organizations/${org!.id}`
      );
      return res.organization;
    },
    enabled: open && !!org?.id,
  });

  const poc = detail?.poc;
  const currentLogo = clearLogo ? null : uploadedLogo?.logoUrl || detail?.logoUrl || org?.logoUrl || null;
  const busy = isPending || logoUploading;
  const seededFor = useRef<string | null>(null);

  const resetFields = () => {
    setName('');
    setTagline('');
    setIsActive(true);
    setFeatures(defaultFeatures);
    setUploadedLogo(null);
    setLogoUploading(false);
    setClearLogo(false);
    setLogoInputKey((key) => key + 1);
  };

  useEffect(() => {
    if (!open || !org) {
      seededFor.current = null;
      resetFields();
      return;
    }
    const fromDetail = detail?.id === org.id;
    const seedKey = fromDetail ? `${org.id}:detail` : org.id;
    if (seededFor.current === seedKey || seededFor.current === `${org.id}:detail`) return;
    seededFor.current = seedKey;
    const source = fromDetail ? detail : org;
    setName(source.name);
    setTagline(source.tagline || '');
    setIsActive(source.isActive);
    setFeatures(resolveFeatures(source));
    setUploadedLogo(null);
    setClearLogo(false);
    setLogoInputKey((key) => key + 1);
  }, [open, org, detail]);

  return (
    <Modal
      open={open && !!org}
      onClose={() => {
        if (busy) return;
        onClose();
      }}
      size="lg"
      title="Edit client"
      description="Rename, update branding, change plan, or suspend. Subdomain stays locked."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-org-form" disabled={busy}>
            {logoUploading ? 'Uploading image…' : isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {org && (
        <form
          id="edit-org-form"
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const nextName = name.trim();
            if (!nextName) return;
            const body: OrgSaveBody = {
              name: nextName,
              isActive,
              features,
              tagline: tagline.trim(),
            };
            if (uploadedLogo) {
              body.logoUrl = uploadedLogo.logoUrl;
              body.logoStoragePath = uploadedLogo.logoStoragePath;
            } else if (clearLogo) {
              body.clearLogo = true;
            }
            try {
              await onSave(org.id, body);
              onClose();
            } catch {
              /* error toast is shown by the save mutation */
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="ah-label">Subdomain</p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{org.subdomain}</p>
            </div>
            <div>
              <p className="ah-label">Database</p>
              <p className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">
                {org.dbName || '—'}
              </p>
            </div>
            <div>
              <label htmlFor="edit-org-name" className="ah-label">
                Name
              </label>
              <Input
                id="edit-org-name"
                required
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-org-tagline" className="ah-label">
              Tagline
            </label>
            <Input
              id="edit-org-tagline"
              className="mt-1"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={160}
              placeholder="Shown on the login page"
            />
          </div>

          <div>
            <p className="ah-label mb-1.5">Logo</p>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                {currentLogo ? (
                  <img src={currentLogo} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] font-medium text-slate-400">None</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  key={logoInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      toast.error('Image must be 1MB or smaller');
                      e.target.value = '';
                      return;
                    }
                    setLogoUploading(true);
                    try {
                      const uploaded = await uploadClientLogo(file, org.subdomain);
                      setUploadedLogo(uploaded);
                      setClearLogo(false);
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                      toast.error(msg || 'Could not upload image');
                      setLogoInputKey((key) => key + 1);
                    } finally {
                      setLogoUploading(false);
                    }
                  }}
                />
                {uploadedLogo ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 hover:underline"
                    onClick={() => {
                      setUploadedLogo(null);
                      setLogoInputKey((key) => key + 1);
                    }}
                  >
                    Clear image
                  </button>
                ) : null}
                <p className="text-[11px] text-slate-400">
                  {logoUploading
                    ? 'Uploading to Supabase…'
                    : 'Max 1MB. Uploaded first; Save sends the image URL with the other fields.'}
                </p>
                {(org.logoUrl || detail?.logoUrl) && !clearLogo && !uploadedLogo ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline"
                    onClick={() => {
                      setClearLogo(true);
                      setUploadedLogo(null);
                      setLogoInputKey((key) => key + 1);
                    }}
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <p className="ah-label mb-1.5">Point of contact</p>
            {pocLoading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : poc ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="ah-label">Name</p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{poc.name || '—'}</p>
                </div>
                <div>
                  <p className="ah-label">Email</p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{poc.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No admin provisioned</p>
            )}
          </div>

          <PlanPicker value={features} onChange={setFeatures} />

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <p className="text-sm text-slate-700 dark:text-slate-200">Active</p>
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
  const [uploadedLogo, setUploadedLogo] = useState<UploadedLogo | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [subdomainTouched, setSubdomainTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyCreateForm);
      setUploadedLogo(null);
      setLogoUploading(false);
      setLogoInputKey((key) => key + 1);
      setSubdomainTouched(false);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        subdomain: form.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        isActive: form.isActive,
        features: form.features,
      };
      if (form.tagline.trim()) body.tagline = form.tagline.trim();
      if (form.adminEmail.trim() && form.adminPassword) {
        body.adminEmail = form.adminEmail.trim().toLowerCase();
        body.adminPassword = form.adminPassword;
        if (form.firstName.trim()) body.firstName = form.firstName.trim();
        if (form.lastName.trim()) body.lastName = form.lastName.trim();
      }
      if (uploadedLogo) {
        body.logoUrl = uploadedLogo.logoUrl;
        body.logoStoragePath = uploadedLogo.logoStoragePath;
      }

      const { data } = await platformApi.post<CreateOrgResponse>('/platform/organizations', body);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });

      toast.success(
        data.adminProvisioned
          ? `Client created — admin can sign in with subdomain: ${data.organization.subdomain}`
          : 'Client created'
      );
      setForm(emptyCreateForm);
      setUploadedLogo(null);
      setLogoInputKey((key) => key + 1);
      setSubdomainTouched(false);
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not create client');
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
      onClose={() => {
        if (createMutation.isPending || logoUploading) return;
        onClose();
      }}
      size="lg"
      title="Create client"
      description="Add a school/client. Upload their logo for the login page."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createMutation.isPending || logoUploading}>
            Cancel
          </Button>
          <Button type="submit" form="create-org-form" disabled={createMutation.isPending || logoUploading}>
            {logoUploading ? 'Uploading image…' : createMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        id="create-org-form"
        className="space-y-3"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (createMutation.isPending || logoUploading) return;
          createMutation.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="create-org-name" className="ah-label">
              Client name
            </label>
            <Input
              id="create-org-name"
              required
              className="mt-1"
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
              className="mt-1"
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
            <p className="mt-1 text-xs text-slate-500">
              Database name: {form.subdomain || '—'}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="create-org-tagline" className="ah-label">
            Tagline (shown on login)
          </label>
          <Input
            id="create-org-tagline"
            className="mt-1"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Learning that inspires"
            maxLength={160}
          />
        </div>

        <div>
          <label htmlFor="create-org-logo" className="ah-label">
            Logo
          </label>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
              {uploadedLogo ? (
                <img src={uploadedLogo.logoUrl} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[10px] font-medium text-slate-400">Logo</span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                key={logoInputKey}
                id="create-org-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  if (file.size > 1024 * 1024) {
                    toast.error('Image must be 1MB or smaller');
                    e.target.value = '';
                    return;
                  }
                  const subdomain = form.subdomain.trim().toLowerCase();
                  if (subdomain.length < 2) {
                    toast.error('Enter a subdomain before choosing a logo');
                    e.target.value = '';
                    return;
                  }
                  setLogoUploading(true);
                  try {
                    const uploaded = await uploadClientLogo(file, subdomain);
                    setUploadedLogo(uploaded);
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                    toast.error(msg || 'Could not upload image');
                    setLogoInputKey((key) => key + 1);
                  } finally {
                    setLogoUploading(false);
                  }
                }}
              />
              {uploadedLogo ? (
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:underline"
                  onClick={() => {
                    setUploadedLogo(null);
                    setLogoInputKey((key) => key + 1);
                  }}
                >
                  Clear image
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">PNG, JPEG, WebP, GIF, or SVG · max 1MB · stored in Supabase</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">Active</p>
          <Toggle
            checked={form.isActive}
            onChange={(next) => setForm((f) => ({ ...f, isActive: next }))}
            aria-label="Active"
          />
        </div>

        <PlanPicker
          value={form.features}
          onChange={(features) => setForm((f) => ({ ...f, features }))}
        />

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-500">Optional first admin</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="create-org-admin-email" className="ah-label">
                Admin email
              </label>
              <Input
                id="create-org-admin-email"
                type="email"
                className="mt-1"
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
              <PasswordInput
                id="create-org-admin-password"
                className="mt-1"
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
                className="mt-1"
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
                className="mt-1"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="off"
              />
            </div>
          </div>
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
    mutationFn: async ({ id, body }: { id: string; body: OrgSaveBody }) => {
      const { data: res } = await platformApi.patch<{ organization: PlatformOrg }>(
        `/platform/organizations/${id}`,
        body
      );
      return res.organization;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-organizations'] });
      qc.invalidateQueries({ queryKey: ['platform-organization'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success('Saved');
    },
    onError: () => toast.error('Update failed'),
  });

  const saveOrg = (id: string, body: OrgSaveBody) => patchMutation.mutateAsync({ id, body });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((org) => {
      if (statusFilter === 'active' && !org.isActive) return false;
      if (statusFilter === 'suspended' && org.isActive) return false;
      if (!q) return true;
      return (
        org.name.toLowerCase().includes(q) ||
        org.subdomain.toLowerCase().includes(q) ||
        (org.dbName || '').toLowerCase().includes(q)
      );
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
        eyebrow="Master registry"
        title="Clients"
        description="Create schools/clients with logo branding. Subdomain cannot change after creation."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create client
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
              title="No clients yet"
              description="Create your first client to provision their database and invite an admin."
              action={
                <Button onClick={() => setCreateOpen(true)}>Create client</Button>
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
                  <th>Client</th>
                  <th>Subdomain</th>
                  <th>Database</th>
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
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                        ) : (
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-sm ${avatarTone(org.name)}`}
                          >
                            {orgInitials(org.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">{org.name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {org.tagline || `ID · ${org.id.slice(0, 8)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {org.subdomain}
                      </code>
                    </td>
                    <td>
                      <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {org.dbName || '—'}
                      </code>
                    </td>
                    <td>
                      {(() => {
                        const sub = subscriptionSummary(org);
                        return <Badge tone={sub.tone}>{sub.label}</Badge>;
                      })()}
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
            Showing {filtered.length} of {counts.total} client{counts.total === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  );
}
