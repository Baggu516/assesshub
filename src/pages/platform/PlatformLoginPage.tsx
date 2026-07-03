import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearPlatformSession, platformApi, setPlatformToken } from '@/lib/platformApi';
import { Card } from '@/components/ui/Card';

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[rgb(var(--surface))]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Platform admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use an account from <strong className="font-medium text-slate-700 dark:text-slate-300">Platform → Users</strong>{' '}
            (registry), or env-based{' '}
            <code className="text-xs">PLATFORM_ADMIN_EMAIL</code> /{' '}
            <code className="text-xs">PLATFORM_ADMIN_PASSWORD</code> (or bcrypt hash).
          </p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
