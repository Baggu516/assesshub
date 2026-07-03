import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/platformApi';
import { CardStat } from '@/components/ui/Card';

type Stats = {
  totalOrganizations: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
};

export function PlatformDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data: res } = await platformApi.get<Stats>('/platform/stats');
      return res;
    },
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        Could not load dashboard stats.
      </div>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of registered organizations (registry). Tenant app data lives in per-subdomain databases.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CardStat label="Total tenants" value={data.totalOrganizations} hint="Organizations in registry" />
        <CardStat label="Active" value={data.activeOrganizations} hint="Can sign in and use the API" />
        <CardStat label="Suspended" value={data.inactiveOrganizations} hint="Blocked at tenant resolution" />
      </div>
    </div>
  );
}
