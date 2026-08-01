import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearPlatformSession, platformApi, setPlatformToken } from '@/lib/platformApi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function PlatformLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[rgb(var(--surface))] p-6">
      <div className="pointer-events-none absolute inset-0 bg-mesh-light dark:bg-mesh-dark" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md animate-fade-up space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-600 text-white shadow-glow">
            <span className="font-display text-sm font-bold">AH</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Platform admin
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in with your platform credentials</p>
        </div>

        <Card className="shadow-glow">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="ah-label">
              Email
              <Input
                type="email"
                autoComplete="username"
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="ah-label">
              Password
              <div className="relative mt-1.5">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
