import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { PERMISSIONS } from '@/constants/permissions';
import { useTenantOrganization } from '@/hooks/api/useTenant';
import { resolveNavLabel } from '@/lib/sidebarLabels';
import { AiChatWidget } from '@/components/dashboard/AiChatWidget';

const SIDEBAR_KEY = 'ah_sidebar_collapsed';

function can(p: string[], k: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  return p.includes(k);
}

function NavIcon({ to }: { to: string }) {
  const cls = 'h-5 w-5 shrink-0';
  switch (to) {
    case '/':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case '/subordinates':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case '/users':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case '/group-students':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case '/classes':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case '/academic-years':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case '/class-masters':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case '/promotions':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case '/profile':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case '/organization':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case '/settings':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case '/knowledge-base':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case '/assessments':
    case '/my-assessments':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    default:
      return <span className={cls} />;
  }
}

function ThemeIcon({ className }: { className?: string }) {
  const cls = className ?? 'h-5 w-5 shrink-0';
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  const cls = className ?? 'h-5 w-5 shrink-0';
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function AppLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { resolved, setMode, mode } = useTheme();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_KEY) === '1' : false
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: org } = useTenantOrganization();

  const sidebarLabels = org?.settings?.sidebarLabels;
  const hasAiPlan = (org?.plan ?? 'ai_dashboard') === 'ai_dashboard';

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const items: { to: string; label: string; show: boolean }[] = useMemo(
    () => {
      const isTeacher = user?.hierarchyRole === 'subordinate';
      return [
      { to: '/', label: resolveNavLabel('/', user?.hierarchyRole, sidebarLabels), show: true },
      {
        to: '/subordinates',
        label: resolveNavLabel('/subordinates', user?.hierarchyRole, sidebarLabels),
        show: !!user && can(user.permissions, PERMISSIONS.SUBORDINATE_CREATE),
      },
      {
        to: '/academic-years',
        label: resolveNavLabel('/academic-years', user?.hierarchyRole, sidebarLabels),
        show:
          !!user &&
          user.hierarchyRole === 'admin' &&
          (can(user.permissions, PERMISSIONS.CLASS_MANAGE) ||
            can(user.permissions, PERMISSIONS.SETTINGS_MANAGE)),
      },
      {
        to: '/class-masters',
        label: resolveNavLabel('/class-masters', user?.hierarchyRole, sidebarLabels),
        show:
          !!user &&
          user.hierarchyRole === 'admin' &&
          (can(user.permissions, PERMISSIONS.CLASS_MANAGE) ||
            can(user.permissions, PERMISSIONS.SETTINGS_MANAGE)),
      },
      {
        to: '/classes',
        label: resolveNavLabel('/classes', user?.hierarchyRole, sidebarLabels),
        show:
          !!user &&
          user.hierarchyRole === 'admin' &&
          (can(user.permissions, PERMISSIONS.CLASS_MANAGE) ||
            can(user.permissions, PERMISSIONS.SETTINGS_MANAGE)),
      },
      {
        to: '/promotions',
        label: resolveNavLabel('/promotions', user?.hierarchyRole, sidebarLabels),
        show:
          !!user &&
          user.hierarchyRole === 'admin' &&
          (can(user.permissions, PERMISSIONS.CLASS_MANAGE) ||
            can(user.permissions, PERMISSIONS.SETTINGS_MANAGE)),
      },
      {
        to: '/users',
        label: resolveNavLabel('/users', user?.hierarchyRole, sidebarLabels),
        show:
          !!user &&
          ((user.hierarchyRole === 'admin' && can(user.permissions, PERMISSIONS.USER_CREATE)) ||
            (isTeacher && can(user.permissions, PERMISSIONS.ASSESSMENT_CREATE))),
      },
      {
        to: '/group-students',
        label: resolveNavLabel('/group-students', user?.hierarchyRole, sidebarLabels),
        show: !!user && isTeacher && can(user.permissions, PERMISSIONS.ASSESSMENT_CREATE),
      },
      {
        to: '/assessments',
        label: resolveNavLabel('/assessments', user?.hierarchyRole, sidebarLabels),
        show: !!user && isTeacher && can(user.permissions, PERMISSIONS.ASSESSMENT_CREATE),
      },
      {
        to: '/my-assessments',
        label: resolveNavLabel('/my-assessments', user?.hierarchyRole, sidebarLabels),
        show: !!user && user.hierarchyRole === 'user',
      },
      { to: '/profile', label: resolveNavLabel('/profile', user?.hierarchyRole, sidebarLabels), show: true },
      {
        to: '/organization',
        label: resolveNavLabel('/organization', user?.hierarchyRole, sidebarLabels),
        show: !!user && can(user.permissions, PERMISSIONS.SETTINGS_MANAGE),
      },
      {
        to: '/settings',
        label: resolveNavLabel('/settings', user?.hierarchyRole, sidebarLabels),
        show: !!user && can(user.permissions, PERMISSIONS.SETTINGS_MANAGE),
      },
      {
        to: '/knowledge-base',
        label: resolveNavLabel('/knowledge-base', user?.hierarchyRole, sidebarLabels),
        show: hasAiPlan && user?.hierarchyRole === 'admin',
      },
    ];
    },
    [user, sidebarLabels, hasAiPlan]
  );

  const visibleItems = useMemo(() => items.filter((i) => i.show), [items]);

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const themeLabel = mode === 'system' ? `System (${resolved})` : mode.charAt(0).toUpperCase() + mode.slice(1);
  const themeTitle = `Theme: ${themeLabel} — click to change`;

  const sidebarActionClass = (collapsed: boolean) =>
    clsx(
      'flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors',
      collapsed ? 'justify-center px-2' : 'px-3'
    );

  /** Narrow sidebar → show right chevron (expand). Wide → left chevron (collapse). */
  const SidebarToggleGlyph = ({ collapsed }: { collapsed: boolean }) =>
    collapsed ? (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    ) : (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    );

  return (
    <div className="h-dvh flex overflow-hidden bg-[rgb(var(--surface))]">
      <aside
        className={clsx(
          'hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur transition-[width] duration-200 ease-out shrink-0 h-full',
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
                <span className="font-semibold text-slate-900 dark:text-white truncate">AssessHub</span>
                <span className="ml-2 text-xs text-slate-500 shrink-0 hidden xl:inline">Education</span>
              </>
            ) : (
              <span className="font-bold text-lg text-brand-600 dark:text-brand-400" title="AssessHub">
                A
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
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.label}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-2' : 'px-3',
                    isActive
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )
                }
              >
                <NavIcon to={item.to} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
        </nav>
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-2 space-y-1">
          {!collapsed ? (
            <div className="px-3 py-1 text-xs text-slate-500 truncate" title={user?.email}>
              {user?.email}
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <span
                className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300"
                title={user?.email}
              >
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={cycleTheme}
            title={themeTitle}
            className={sidebarActionClass(collapsed)}
          >
            <ThemeIcon />
            {!collapsed && <span className="truncate">Theme · {themeLabel}</span>}
          </button>
          <button
            type="button"
            onClick={logout}
            title="Log out"
            className={clsx(
              sidebarActionClass(collapsed),
              'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400'
            )}
          >
            <LogoutIcon />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl transition-transform duration-200 md:hidden',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Menu</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )
                }
              >
                <NavIcon to={item.to} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
            <p className="text-xs text-slate-500 truncate px-1" title={user?.email}>
              {user?.email}
            </p>
            <button
              type="button"
              onClick={cycleTheme}
              title={themeTitle}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ThemeIcon />
              Theme · {themeLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogoutIcon />
              Log out
            </button>
          </div>
        </aside>

        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="md:hidden fixed top-4 left-4 z-30 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-2.5 text-slate-600 shadow-sm hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <main className="flex-1 w-full min-w-0 min-h-0 p-4 pt-16 md:pt-8 md:p-8 overflow-y-auto">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
        {hasAiPlan ? <AiChatWidget /> : null}
      </div>
    </div>
  );
}
