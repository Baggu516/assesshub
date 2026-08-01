import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Button, Card, FormField, Input } from '@/components/ui';

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
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[rgb(var(--surface))]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg mb-4">
            A
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Assessment platform for schools</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              label="Organization subdomain"
              htmlFor="subdomain"
              required
              hint={`Matches your URL: ${subdomain || 'acme'}.assesshub.com`}
            >
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="e.g. acme"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </FormField>
            <FormField label="Password" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </FormField>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="text-center text-sm text-slate-500">
          <Link className="text-brand-600 hover:underline dark:text-brand-400" to="/platform/login">
            Platform admin
          </Link>
        </p>
      </div>
    </div>
  );
}
