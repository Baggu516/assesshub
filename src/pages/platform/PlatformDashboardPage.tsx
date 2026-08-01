import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { platformApi } from '@/lib/platformApi';
import { Button } from '@/components/ui/Button';
import { CardStat } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

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
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        Could not load dashboard stats.
      </div>
    );
  }

  return (
    <div className="ah-page">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Registry health at a glance. Tenant app data lives in per-subdomain databases."
        actions={
          <Link to="/platform/orgs">
            <Button>Manage organizations</Button>
          </Link>
        }
      />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-700 dark:bg-slate-900/50"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <CardStat
            label="Total tenants"
            value={data.totalOrganizations}
            hint="Organizations in registry"
            accent="brand"
          />
          <CardStat
            label="Active"
            value={data.activeOrganizations}
            hint="Can sign in and use the API"
            accent="success"
          />
          <CardStat
            label="Suspended"
            value={data.inactiveOrganizations}
            hint="Blocked at tenant resolution"
            accent="warning"
          />
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-600 via-teal-600 to-cyan-700 p-6 text-white shadow-glow dark:border-brand-800/40">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl"
          aria-hidden
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-100">
          Quick actions
        </p>
        <h2 className="relative mt-2 font-display text-xl font-bold tracking-tight">
          Keep the registry tidy
        </h2>
        <p className="relative mt-1.5 max-w-lg text-sm text-teal-50/90">
          Provision new tenants, suspend inactive orgs, and manage platform operators from one place.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link
            to="/platform/orgs"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
          >
            Organizations
          </Link>
          <Link
            to="/platform/users"
            className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Platform users
          </Link>
        </div>
      </div>
    </div>
  );
}
