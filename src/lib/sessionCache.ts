import type { AuthUser } from '@/types/user';

const USER_PREFIX = 'ah_session_user:';
const TENANT_PREFIX = 'ah_session_tenant:';

export type OrgPlan = 'assessments_only' | 'ai_dashboard';

export type CachedTenantOrganization = {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  plan?: OrgPlan;
  createdAt?: string;
  updatedAt?: string;
  settings?: {
    timezone?: string;
    sidebarLabels?: Record<string, string | undefined>;
  };
};

function userKey(subdomain: string) {
  return `${USER_PREFIX}${subdomain}`;
}

function tenantKey(subdomain: string) {
  return `${TENANT_PREFIX}${subdomain}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCachedUser(subdomain: string): AuthUser | null {
  if (!subdomain) return null;
  return readJson<AuthUser>(userKey(subdomain));
}

export function setCachedUser(subdomain: string, user: AuthUser) {
  if (!subdomain) return;
  writeJson(userKey(subdomain), user);
}

export function getCachedTenant(subdomain: string): CachedTenantOrganization | null {
  if (!subdomain) return null;
  return readJson<CachedTenantOrganization>(tenantKey(subdomain));
}

export function setCachedTenant(subdomain: string, organization: CachedTenantOrganization) {
  if (!subdomain) return;
  writeJson(tenantKey(subdomain), organization);
}

/** Remove cached session data (optionally for one tenant). */
export function clearSessionCache(subdomain?: string) {
  if (subdomain) {
    localStorage.removeItem(userKey(subdomain));
    localStorage.removeItem(tenantKey(subdomain));
    return;
  }
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(USER_PREFIX) || key.startsWith(TENANT_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
