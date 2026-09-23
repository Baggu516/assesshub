import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearPlatformSession, platformApi, setPlatformToken } from '@/lib/platformApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      clearPlatformSession();
      const { data } = await platformApi.post<{ accessToken: string }>('/platform/login', {
        email: email.trim(),
        password,
      });
      setPlatformToken(data.accessToken);
      toast.success('Signed in');
      navigate('/platform', { replace: true });
    } catch {
      toast.error('Invalid email or password, or login not configured on the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6F8] p-6 dark:bg-[rgb(var(--surface))]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 15% 10%, rgb(20 184 166 / 0.12), transparent 55%), radial-gradient(ellipse 55% 40% at 90% 90%, rgb(14 165 233 / 0.08), transparent 50%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl motion-safe:animate-drift dark:bg-brand-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl motion-safe:animate-drift-slow"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm motion-safe:animate-rise-in">
        <div className="mb-10 text-center">
          <p className="font-display text-3xl font-extrabold tracking-tight text-brand-800 dark:text-brand-300">
            ClassTrio
          </p>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Platform admin
          </h1>
          <p className="mt-2 text-sm text-slate-500">Sign in with your platform credentials</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block space-y-2 text-[13px] font-medium text-slate-600 dark:text-slate-400">
            Email
            <Input
              type="email"
              autoComplete="username"
              className="rounded-2xl border-slate-200/90 py-3 shadow-soft"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-2 text-[13px] font-medium text-slate-600 dark:text-slate-400">
            Password
            <PasswordInput
              autoComplete="current-password"
              className="[&_input]:rounded-2xl [&_input]:border-slate-200/90 [&_input]:py-3 [&_input]:shadow-soft"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-2xl py-3.5 text-[15px] shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-12 text-center text-[13px] text-slate-400">
          <Link
            className="font-medium underline decoration-slate-300 underline-offset-[5px] transition-colors hover:text-brand-700 hover:decoration-brand-400 dark:hover:text-brand-300"
            to="/login"
          >
            Back to tenant login
          </Link>
        </p>
      </div>
    </div>
  );
}
