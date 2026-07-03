import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import {
  useTenantOrganization,
  useTenantOrganizationMutations,
  type TenantOrganization,
} from '@/hooks/api/useTenant';

export function OrganizationPage() {
  const { data, isLoading } = useTenantOrganization();
  const { applyTenantUpdate } = useTenantOrganizationMutations();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    if (data) {
      setName(data.name);
      setTimezone(data.settings?.timezone || 'UTC');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: res } = await api.patch<{ organization: TenantOrganization }>('/tenant/settings', {
        name,
        settings: { timezone },
      });
      return res.organization;
    },
    onSuccess: (organization) => {
      applyTenantUpdate(organization);
      toast.success('Organization updated');
    },
    onError: () => toast.error('Could not save'),
  });

  if (isLoading || !data) {
    return (
      <div className="text-sm text-slate-500">
        {isLoading ? 'Loading organization…' : 'No organization data.'}
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Organization</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your workspace uses one registry MongoDB document (model Organization): created when this tenant was
          registered. Subdomain and activation are changed from the platform console; here you can update display name
          and timezone. Use Settings for sidebar labels only.
        </p>
      </div>

      <Card>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 sm:col-span-2">
                Organization name
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Subdomain</span>
                <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-sm font-mono">
                  {data.subdomain}
                </div>
                <p className="text-xs text-slate-500 mt-1">Immutable — ties this app to its tenant database.</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Registry status</span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={
                      data.isActive
                        ? 'inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-sm'
                        : 'inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-sm'
                    }
                  >
                    <span
                      className={
                        data.isActive ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-amber-500'
                      }
                      aria-hidden
                    />
                    {data.isActive ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Suspended tenants cannot sign in. Managed from platform admin.
                </p>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 sm:col-span-2">
                Default timezone
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. UTC, America/New_York"
                />
              </label>
            </div>
            <div className="grid gap-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-4">
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-400">Organization ID</span>{' '}
                <span className="font-mono text-[11px] break-all">{String(data.id)}</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {data.createdAt && (
                  <span>
                    Created: {new Date(data.createdAt).toLocaleString()}
                  </span>
                )}
                {data.updatedAt && (
                  <span>
                    Last updated: {new Date(data.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              to="/settings"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sidebar labels
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
