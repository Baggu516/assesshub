import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { clearPlatformSession } from '@/lib/platformApi';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';

const SIDEBAR_KEY = 'ah_platform_sidebar_collapsed';

function NavIcon({ to }: { to: string }) {
  const cls = 'h-[1.15rem] w-[1.15rem] shrink-0';
  if (to.includes('/orgs')) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    );
  }
  if (to.includes('/users')) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M3 9h18" />
    </svg>
  );
}

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-2.5 min-w-0', compact && 'justify-center')}>
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-600 text-white shadow-glow"
        aria-hidden
      >
        <span className="font-display text-sm font-bold tracking-tight">CT</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-950" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
            ClassTrio
          </p>
          <p className="text-[11px] font-medium leading-normal text-slate-500">Master console</p>
        </div>
      )}
    </div>
  );
}

function pageMeta(pathname: string) {
  if (pathname.includes('/orgs')) return { title: 'Clients', crumb: 'Master · Clients' };
  if (pathname.includes('/users')) return { title: 'Operators', crumb: 'Master · Operators' };
  return { title: 'Dashboard', crumb: 'Master · Overview' };
}

export function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolved, setMode, mode } = useTheme();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_KEY) === '1' : false
  );
  const meta = pageMeta(location.pathname);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const items = useMemo(
    () => [
      { to: '/platform', label: 'Dashboard', end: true },
      { to: '/platform/orgs', label: 'Clients', end: false },
      { to: '/platform/users', label: 'Operators', end: false },
    ],
    []
  );

  const exit = () => {
    clearPlatformSession();
    navigate('/login', { replace: true });
  };

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const themeLabel = mode === 'system' ? `System · ${resolved}` : mode === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="relative flex min-h-screen bg-[rgb(var(--surface))]">
      <div
        className="pointer-events-none absolute inset-0 bg-mesh-light dark:bg-mesh-dark"
        aria-hidden
      />

      <aside
        className={clsx(
          'relative z-10 hidden shrink-0 flex-col border-r border-slate-200/70 bg-white/75 backdrop-blur-xl transition-[width] duration-300 ease-out dark:border-slate-800/80 dark:bg-slate-950/75 md:flex',
          collapsed ? 'w-[84px]' : 'w-[17.5rem]'
        )}
      >
        <div className="flex h-16 min-h-[4rem] items-center gap-1 border-b border-slate-200/70 px-3 dark:border-slate-800/80">
          <div className={clsx('min-w-0 flex-1 overflow-hidden', collapsed ? 'flex justify-center' : 'px-1')}>
            <BrandMark compact={collapsed} />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Manage
            </p>
          )}
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150',
                  collapsed ? 'justify-center px-2' : 'px-3',
                  isActive
                    ? 'bg-brand-600 text-white shadow-glow'
                    : 'text-slate-600 hover:bg-slate-100/90 dark:text-slate-400 dark:hover:bg-slate-800/80'
                )
              }
            >
              <NavIcon to={item.to} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className={clsx(
            'border-t border-slate-200/70 p-3 dark:border-slate-800/80',
            collapsed && 'flex justify-center'
          )}
        >
          {!collapsed ? (
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-brand-50/60 px-3 py-2.5 dark:from-slate-900 dark:to-brand-950/40">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Super admin</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Full registry access</p>
            </div>
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
              title="Super admin"
            >
              ★
            </span>
          )}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b border-slate-200/70 bg-white/70 px-2 py-2 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/60 md:hidden">
          <div className="flex min-w-max gap-1.5">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/60 px-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/50 md:px-8">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {meta.crumb}
            </p>
            <p className="truncate font-display text-sm font-bold text-slate-800 dark:text-slate-100 md:hidden">
              {meta.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              className="hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex"
              title="Cycle theme"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
              {themeLabel}
            </button>
            <Button variant="inverse" size="sm" onClick={exit}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
