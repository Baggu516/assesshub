import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { AuthUser } from '@/types/user';

export type TenantSessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  subdomain: string;
};
import { api, clearTokens, configureApiHooks, setTokens } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { clearSessionCache, getCachedUser, setCachedUser } from '@/lib/sessionCache';
import { useTenant } from './TenantContext';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Apply tokens + tenant subdomain (e.g. after platform creates org with admin). */
  applyTenantSession: (payload: TenantSessionPayload) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { subdomain, setSubdomain } = useTenant();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('ah_access_token');
    const sub = localStorage.getItem('ah_tenant_subdomain');
    if (!token || !sub) return null;
    return getCachedUser(sub);
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    const token = localStorage.getItem('ah_access_token');
    const sub = localStorage.getItem('ah_tenant_subdomain');
    if (!token || !sub) return false;
    return !getCachedUser(sub);
  });

  const refreshSession = useCallback(async () => {
    const { data } = await api.get<{ user: AuthUser }>('/auth/me');
    setUser(data.user);
    if (subdomain) setCachedUser(subdomain, data.user);
  }, [subdomain]);

  const applyTenantSession = useCallback((payload: TenantSessionPayload) => {
    setSubdomain(payload.subdomain);
    setTokens(payload.accessToken, payload.refreshToken);
    setUser(payload.user);
    setCachedUser(payload.subdomain, payload.user);
    queryClient.removeQueries({ queryKey: ['users'] });
  }, [setSubdomain]);

  useEffect(() => {
    configureApiHooks({
      getSubdomain: () => subdomain || null,
      onAuthFailure: () => {
        clearSessionCache(subdomain || undefined);
        setUser(null);
        clearTokens();
        navigate('/login', { replace: true });
      },
    });
  }, [subdomain, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem('ah_access_token');
      if (!token || !subdomain) {
        setLoading(false);
        return;
      }

      const cached = getCachedUser(subdomain);
      if (cached) {
        if (!cancelled) {
          setUser(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const { data } = await api.get<{ user: AuthUser }>('/auth/me');
        if (!cancelled) {
          setUser(data.user);
          setCachedUser(subdomain, data.user);
        }
      } catch {
        if (!cancelled) {
          clearSessionCache(subdomain);
          clearTokens();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subdomain]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!subdomain) {
        toast.error('Enter your organization subdomain first.');
        throw new Error('missing_tenant');
      }
      const { data } = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      setCachedUser(subdomain, data.user);
      queryClient.removeQueries({ queryKey: ['users'] });
      toast.success('Welcome back');
      navigate('/');
    },
    [subdomain, navigate]
  );

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('ah_refresh_token');
    try {
      if (refresh) await api.post('/auth/logout', { refreshToken: refresh });
    } catch {
      /* ignore */
    }
    clearTokens();
    clearSessionCache(subdomain || undefined);
    setUser(null);
    queryClient.clear();
    navigate('/login');
  }, [navigate, subdomain]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      applyTenantSession,
      refreshSession,
    }),
    [user, loading, login, logout, applyTenantSession, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
