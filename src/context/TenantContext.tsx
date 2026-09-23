import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isMasterHost } from '@/lib/masterHost';

const STORAGE_KEY = 'ah_tenant_subdomain';

interface TenantContextValue {
  subdomain: string;
  setSubdomain: (s: string) => void;
  /** True when this session is the reserved master org (full app + Clients). */
  isMasterTenant: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function inferSubdomainFromHost(): string | null {
  const host = window.location.hostname.toLowerCase();
  const base = (import.meta.env.VITE_BASE_DOMAIN || 'classtrio.in').toLowerCase();

  if (isMasterHost(host) && (host === 'localhost' || host === '127.0.0.1' || host.startsWith('master.'))) {
    return 'master';
  }

  if (host.endsWith(`.${base}`) && host !== base) {
    const sub = host.replace(`.${base}`, '').split('.')[0] || null;
    return sub === 'master' ? 'master' : sub;
  }
  if (host.endsWith('.localhost')) {
    return host.replace('.localhost', '').split('.')[0] || null;
  }
  return null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomainState] = useState(() => {
    const fromHost = inferSubdomainFromHost();
    if (fromHost) return fromHost;
    if (typeof window !== 'undefined' && isMasterHost()) return 'master';
    return localStorage.getItem(STORAGE_KEY) || 'master';
  });

  useEffect(() => {
    const fromHost = inferSubdomainFromHost();
    if (fromHost) {
      setSubdomainState(fromHost);
      localStorage.setItem(STORAGE_KEY, fromHost);
      return;
    }
    if (isMasterHost()) {
      setSubdomainState('master');
      localStorage.setItem(STORAGE_KEY, 'master');
    }
  }, []);

  const setSubdomain = (s: string) => {
    const v = s.trim().toLowerCase();
    setSubdomainState(v);
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const isMasterTenant = subdomain === 'master';

  const value = useMemo(
    () => ({
      subdomain,
      setSubdomain,
      isMasterTenant,
    }),
    [subdomain, isMasterTenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
