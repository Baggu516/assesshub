import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { ForgotPasswordPanel } from '@/components/auth/ForgotPasswordPanel';
import { ClassTrioMark } from '@/components/brand/ClassTrioMark';
import { Button, Input, PasswordInput } from '@/components/ui';
import { isMasterHost, isReservedSubdomain } from '@/lib/masterHost';

type TenantBranding = {
  name: string;
  subdomain: string;
  logoUrl: string | null;
  tagline: string | null;
  isActive: boolean;
};

/** Same story on every school URL and the master console. */
const LOGIN_HIGHLIGHTS = [
  { title: 'AI', label: 'Dashboard chat' },
  { title: 'PDF', label: 'Worksheets' },
  { title: 'CBT', label: 'Online exams' },
];

const REMEMBER_KEY = 'ah_login_remember_email';
const REGISTER_URL = 'https://classtrio.in/#request';
/** Same base as axios. A relative `/api` hits the frontend host, which only serves the app. */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function BrandMark({
  name,
  logoUrl,
  compact,
}: {
  name: string;
  logoUrl?: string | null;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={compact ? 'h-8 w-8 object-contain' : 'h-9 w-9 object-contain'}
        />
      ) : (
        <ClassTrioMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      )}
      <span className={`font-display font-semibold tracking-tight text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
        {name}
      </span>
    </div>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { subdomain, setSubdomain } = useTenant();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'forgot'>('login');
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [brandingStatus, setBrandingStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [lookupAttempt, setLookupAttempt] = useState(0);

  const masterHost = useMemo(() => isMasterHost(), []);
  const hostLockedSubdomain = useMemo(() => {
    const host = window.location.hostname.toLowerCase();
    const base = (import.meta.env.VITE_BASE_DOMAIN || 'classtrio.in').toLowerCase();
    if (host.endsWith(`.${base}`) && host !== base && !host.startsWith('master.')) {
      return host.replace(`.${base}`, '').split('.')[0] || null;
    }
    if (host.endsWith('.localhost') && !host.startsWith('master.')) {
      const sub = host.replace('.localhost', '').split('.')[0] || null;
      return sub === 'master' ? null : sub;
    }
    return null;
  }, []);

  /** Localhost / master.* → reserved master tenant (full app + Clients). */
  const isMasterLogin = masterHost && !hostLockedSubdomain;

  useEffect(() => {
    if (hostLockedSubdomain) {
      setSubdomain(hostLockedSubdomain);
      return;
    }
    if (isMasterLogin) setSubdomain('master');
  }, [hostLockedSubdomain, isMasterLogin, setSubdomain]);

  useEffect(() => {
    const sub = hostLockedSubdomain;
    if (isMasterLogin || !sub || isReservedSubdomain(sub)) {
      setBranding(null);
      setBrandingStatus('ready');
      return;
    }

    let cancelled = false;
    setBrandingStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/public/tenants/${encodeURIComponent(sub)}`);
        if (!res.ok) {
          if (!cancelled) {
            setBranding(null);
            setBrandingStatus(res.status === 404 ? 'missing' : 'error');
          }
          return;
        }
        const data = (await res.json()) as { tenant?: TenantBranding };
        if (cancelled) return;
        if (!data.tenant) {
          setBranding(null);
          setBrandingStatus('missing');
          return;
        }
        setBranding(data.tenant);
        setBrandingStatus('ready');
      } catch {
        if (!cancelled) {
          setBranding(null);
          setBrandingStatus('error');
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hostLockedSubdomain, isMasterLogin, lookupAttempt]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);

      if (isMasterLogin) {
        await login(email, password, 'master');
        return;
      }

      const sub = hostLockedSubdomain || subdomain;
      if (!sub || isReservedSubdomain(sub)) {
        toast.error('Open your school URL to sign in (e.g. school.classtrio.in)');
        return;
      }
      await login(email, password, sub);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const productName = isMasterLogin ? 'ClassTrio' : branding?.name || 'ClassTrio';
  const schoolHost = Boolean(hostLockedSubdomain) && !isMasterLogin;
  const schoolUnknown = schoolHost && brandingStatus !== 'ready';
  const baseDomain = (import.meta.env.VITE_BASE_DOMAIN || 'classtrio.in').toLowerCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel — Enculture-style soft left */}
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-[#E8F7F4] px-10 py-10 lg:flex xl:px-14 xl:py-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 10% 0%, rgb(45 212 191 / 0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgb(20 184 166 / 0.22), transparent 50%), linear-gradient(160deg, #F3FBFA 0%, #DDF4EF 48%, #C8EDE6 100%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl motion-safe:animate-drift"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl motion-safe:animate-drift-slow"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="motion-safe:animate-rise-in">
            <BrandMark name={productName} logoUrl={branding?.logoUrl} />
          </div>

          <div className="my-auto max-w-xl py-16 motion-safe:animate-rise-in motion-safe:[animation-delay:80ms]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800/70">
              School platform
            </p>
            <h1 className="mt-5 font-serif text-[2.75rem] font-semibold leading-[1.12] tracking-tight text-slate-900 xl:text-[3.35rem]">
              <span className="bg-gradient-to-br from-brand-800 via-brand-700 to-teal-600 bg-clip-text text-transparent">
                Assessment for schools
              </span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600">
              Worksheets, assessments, and online exams in one place, with AI chat when a school turns it on.
            </p>
          </div>

          <div className="relative z-10 space-y-6 motion-safe:animate-rise-in motion-safe:[animation-delay:160ms]">
            <div className="grid grid-cols-3 gap-3">
              {LOGIN_HIGHLIGHTS.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl bg-white/80 px-3.5 py-3.5 ring-1 ring-white/90 backdrop-blur-sm"
                >
                  <p className="font-serif text-xl font-semibold text-brand-800">{f.title}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500/80">ClassTrio © {new Date().getFullYear()}. All rights reserved.</p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-screen flex-col bg-white px-6 py-10 dark:bg-[rgb(var(--surface))] sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col justify-center motion-safe:animate-rise-in">
          <div className="mb-10 flex justify-center lg:mb-12">
            <BrandMark name={productName} logoUrl={branding?.logoUrl} compact />
          </div>

          {schoolUnknown ? (
            brandingStatus === 'loading' ? (
              <div className="text-center">
                <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]">
                  Checking this school
                </h2>
                <p className="mt-3 text-sm text-slate-500">
                  Looking up {hostLockedSubdomain}.{baseDomain}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800/70 dark:text-brand-200/80">
                  ClassTrio
                </p>
                <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]">
                  Not registered
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {hostLockedSubdomain}.{baseDomain}
                  </span>{' '}
                  is not registered under ClassTrio. Please register to open this school.
                </p>
                <a
                  href={REGISTER_URL}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-500"
                >
                  Register
                </a>
                {brandingStatus === 'error' ? (
                  <button
                    type="button"
                    onClick={() => setLookupAttempt((n) => n + 1)}
                    className="mt-4 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300"
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            )
          ) : authMode === 'forgot' ? (
            <ForgotPasswordPanel
              tenant={hostLockedSubdomain || subdomain}
              onBack={() => setAuthMode('login')}
            />
          ) : (
          <>
          <div className="text-center">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[2rem]">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isMasterLogin
                ? 'Sign in to the master console'
                : branding
                  ? `Sign in to ${branding.name}`
                  : 'Sign in to ClassTrio'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-9 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                {isMasterLogin ? 'Email' : 'Email or registration ID'}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <MailIcon />
                </span>
                <Input
                  id="email"
                  name="username"
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isMasterLogin ? 'you@classtrio.in' : 'you@school.edu or xyz123'}
                  required
                  autoComplete="username"
                  className="rounded-xl border-brand-200/80 py-3 pl-11 shadow-none focus:border-brand-500 dark:border-slate-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400">
                  <LockIcon />
                </span>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="[&_input]:rounded-xl [&_input]:border-brand-200/80 [&_input]:py-3 [&_input]:pl-11 [&_input]:shadow-none [&_input]:focus:border-brand-500 dark:[&_input]:border-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                />
                Remember me
              </label>
              {isMasterLogin ? (
                <span className="text-sm text-slate-400">Need help? Ask your admin</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  className="text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 w-full rounded-xl py-3.5 text-[15px] font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Login'}
            </Button>
          </form>

          <p className="mt-10 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <span className="font-semibold text-brand-700 dark:text-brand-300">Contact your administrator</span> for
            access.
          </p>
          </>
          )}
        </div>
      </main>
    </div>
  );
}
