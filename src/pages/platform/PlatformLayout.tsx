import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { clearPlatformSession } from '@/lib/platformApi';
import { useTheme } from '@/context/ThemeContext';

const SIDEBAR_KEY = 'tm_platform_sidebar_collapsed';

function NavIcon({ to }: { to: string }) {
  const cls = 'h-5 w-5 shrink-0';
  if (to.includes('/orgs')) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  if (to.includes('/users')) {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M3 9h18" />
    </svg>
  );
}

export function PlatformLayout() {
  const navigate = useNavigate();
  const { resolved, setMode, mode } = useTheme();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_KEY) === '1' : false
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const items = useMemo(
    () => [
      { to: '/platform', label: 'Dashboard', end: true },
      { to: '/platform/orgs', label: 'Organizations', end: false },
      { to: '/platform/users', label: 'Users', end: false },
    ],
    []
  );

  const exit = () => {
    clearPlatformSession();
    navigate('/platform/login', { replace: true });
  };

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const SidebarToggleGlyph = ({ collapsed: c }: { collapsed: boolean }) =>
    c ? (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    ) : (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    );

  return (
    <div className="min-h-screen flex bg-[rgb(var(--surface))]">
      <aside
        className={clsx(
          'hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur transition-[width] duration-200 ease-out shrink-0',
          collapsed ? 'w-[76px]' : 'w-64'
        )}
      >
        <div className="h-14 min-h-[3.5rem] flex items-center border-b border-slate-200/80 dark:border-slate-800 shrink-0 px-2 gap-1">
          <div
            className={clsx(
              'flex items-center min-w-0 flex-1 overflow-hidden',
              collapsed ? 'justify-center pl-0' : 'px-3'
            )}
          >
            {!collapsed ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-white truncate">Platform</span>
                <span className="ml-2 text-xs text-slate-500 shrink-0 hidden xl:inline">Admin</span>
              </>
            ) : (
              <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400" title="Platform admin">
                P
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <SidebarToggleGlyph collapsed={collapsed} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2' : 'px-3',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
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
            'p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 shrink-0',
            collapsed && 'flex justify-center p-2'
          )}
        >
          {!collapsed ? <span>Super admin</span> : <span title="Super admin">★</span>}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/70 px-2 py-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium',
                    isActive
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100'
                      : 'text-slate-600 dark:text-slate-400'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
        <header className="h-14 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 bg-white/70 dark:bg-slate-950/60 backdrop-blur shrink-0">
          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">Registry & tenants</div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cycleTheme}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hidden sm:inline-block"
            >
              Theme: {mode === 'system' ? `system (${resolved})` : mode}
            </button>
            <button
              type="button"
              onClick={exit}
              className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs font-medium"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 w-full min-w-0 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
