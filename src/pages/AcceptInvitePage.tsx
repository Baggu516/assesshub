import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, setTokens } from '@/lib/api';
import { useTenant } from '@/context/TenantContext';
import { Button, Card, FormField, Input } from '@/components/ui';
import type { AuthUser } from '@/types/user';
import { useAuth } from '@/context/AuthContext';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const tenantParam = params.get('tenant') || '';
  const { setSubdomain } = useTenant();
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantParam) {
      toast.error('Missing tenant in invite link');
      return;
    }
    setLoading(true);
    try {
      setSubdomain(tenantParam);
      const { data } = await api.post<{
        accessToken: string;
        refreshToken: string;
        user?: AuthUser;
      }>('/auth/accept-invite', { token, password });
      setTokens(data.accessToken, data.refreshToken);
      await refreshSession();
      toast.success('Account activated');
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(msg || 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[rgb(var(--surface))]">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Accept invitation</h1>
          <p className="mt-1 text-sm text-slate-500">Set a password to join your workspace.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FormField label="New password" htmlFor="invite-password" required>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? 'Saving…' : 'Activate account'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
