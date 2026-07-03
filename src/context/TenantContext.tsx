import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tm_tenant_subdomain';

interface TenantContextValue {
  subdomain: string;
  setSubdomain: (s: string) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function inferSubdomainFromHost(): string | null {
  const host = window.location.hostname.toLowerCase();
  const base = (import.meta.env.VITE_BASE_DOMAIN || 'taskmanagement.com').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return null;
  if (host.endsWith(`.${base}`) && host !== base) {
    return host.replace(`.${base}`, '').split('.')[0] || null;
  }
  if (host.endsWith('.localhost')) {
    return host.replace('.localhost', '').split('.')[0] || null;
  }
  return null;
}

function defaultSubdomainForPlainLocalhost(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const plain = host === 'localhost' || host === '127.0.0.1';
  const v = (import.meta.env.VITE_DEFAULT_TENANT_SUBDOMAIN || '').trim().toLowerCase();
  return plain && v ? v : '';
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomainState] = useState(() => {
    const fromHost = inferSubdomainFromHost();
    if (fromHost) return fromHost;
    const stored = localStorage.getItem(STORAGE_KEY) || '';
    if (stored) return stored;
    return defaultSubdomainForPlainLocalhost();
  });

  useEffect(() => {
    const fromHost = inferSubdomainFromHost();
    if (fromHost) {
      setSubdomainState(fromHost);
      localStorage.setItem(STORAGE_KEY, fromHost);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return;
    const devDefault = defaultSubdomainForPlainLocalhost();
    if (devDefault) {
      setSubdomainState(devDefault);
      localStorage.setItem(STORAGE_KEY, devDefault);
    }
  }, []);

  const setSubdomain = (s: string) => {
    const v = s.trim().toLowerCase();
    setSubdomainState(v);
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      subdomain,
      setSubdomain,
    }),
    [subdomain]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
