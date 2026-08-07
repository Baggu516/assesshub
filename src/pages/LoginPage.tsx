import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Button, Input } from '@/components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const { subdomain, setSubdomain } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel — quiet atmosphere, brand as the hero */}
      <aside className="relative flex min-h-[42vh] flex-col justify-end overflow-hidden bg-brand-800 px-8 pb-12 pt-10 sm:px-12 lg:min-h-screen lg:justify-between lg:px-16 lg:pb-16 lg:pt-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 0% 100%, rgb(45 212 191 / 0.28), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 0%, rgb(15 118 110 / 0.55), transparent 50%), linear-gradient(165deg, #0f766e 0%, #134e4a 55%, #0b3d3a 100%)',
          }}
          aria-hidden
        />
        {/* Soft drifting light */}
        <div
          className="pointer-events-none absolute -left-1/4 top-1/3 h-[28rem] w-[28rem] rounded-full bg-teal-300/20 blur-3xl motion-safe:animate-[fade-in_1.6s_ease-out_both]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-1/4 bottom-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-[fade-in_2s_ease-out_0.2s_both]"
          aria-hidden
        />

        <div className="relative z-10 animate-fade-up">
          <p className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            AssessHub
          </p>
          <p className="mt-5 max-w-[14rem] text-lg leading-snug text-white/90 sm:max-w-none sm:text-xl">
            Assessment for schools
          </p>
          <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-teal-100/55">
            AI that helps teachers teach and students learn
          </p>
        </div>

        <p className="relative z-10 mt-10 hidden text-sm text-teal-100/45 animate-[fade-in_0.8s_ease-out_0.35s_both] lg:mt-0 lg:block">
          Teachers · Students · Admins
        </p>
      </aside>

      {/* Sign-in */}
      <main className="relative flex flex-col justify-center overflow-hidden bg-[rgb(var(--surface))] px-6 py-16 sm:px-12 lg:px-20 xl:px-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 80% 20%, rgb(20 184 166 / 0.07), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 90%, rgb(14 165 233 / 0.05), transparent 50%)',
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-[20rem] animate-fade-up">
          <div className="mb-12 lg:hidden">
            <p className="font-display text-xl font-bold tracking-tight text-brand-800 dark:text-brand-300">
              AssessHub
            </p>
          </div>

          <h1 className="font-display text-[1.65rem] font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in
          </h1>

          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <label htmlFor="subdomain" className="block text-[13px] text-slate-500 dark:text-slate-400">
                School
              </label>
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-600 dark:bg-slate-950">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="your-school"
                  required
                  className="rounded-none border-0 focus:ring-0"
                />
                <span className="flex shrink-0 items-center border-l border-slate-100 bg-slate-50/80 px-3 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/80">
                  .assesshub.com
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-[13px] text-slate-500 dark:text-slate-400">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[13px] text-slate-500 dark:text-slate-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[12px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Continue'}
            </Button>
          </form>

          <p className="mt-14 text-center text-[13px] text-slate-400/80">
            <Link
              className="underline underline-offset-4 transition-colors hover:text-brand-700 dark:hover:text-brand-300"
              to="/platform/login"
            >
              Platform admin
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
