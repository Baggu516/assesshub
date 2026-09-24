import type { AuthUser } from '@/types/user';

const USER_PREFIX = 'ah_session_user:';
const TENANT_PREFIX = 'ah_session_tenant:';

export type OrgPlan = 'assessments_only' | 'ai_dashboard';

export type OrgFeatures = {
  aiDashboard: boolean;
  aiAssessmentCreate: boolean;
  worksheets: boolean;
  assessments: boolean;
  onlineExams: boolean;
};

/** Master console is not a paid plan. Every product flag stays on. */
export const ALL_ORG_FEATURES: OrgFeatures = {
  aiDashboard: true,
  aiAssessmentCreate: true,
  worksheets: true,
  assessments: true,
  onlineExams: true,
};

/** Match the API: missing newer flags stay off, missing onlineExams stays on. */
export function resolveOrgFeatures(
  org?: { subdomain?: string; plan?: OrgPlan; features?: Partial<OrgFeatures> | null } | null
): OrgFeatures {
  if (org?.subdomain === 'master') return { ...ALL_ORG_FEATURES };

  const raw = org?.features;
  if (!raw) {
    return {
      aiDashboard: org?.plan === 'ai_dashboard',
      aiAssessmentCreate: false,
      worksheets: false,
      assessments: false,
      onlineExams: Boolean(org),
    };
  }
  const has = (key: keyof OrgFeatures) => Object.prototype.hasOwnProperty.call(raw, key);
  return {
    aiDashboard: raw.aiDashboard === true,
    aiAssessmentCreate: raw.aiAssessmentCreate === true,
    worksheets: has('worksheets') ? raw.worksheets === true : false,
    assessments: has('assessments') ? raw.assessments === true : false,
    onlineExams: has('onlineExams') ? raw.onlineExams === true : true,
  };
}

export type CachedTenantOrganization = {
  id: string;
  name: string;
  subdomain: string;
  dbName?: string | null;
  isActive: boolean;
  plan?: OrgPlan;
  features?: OrgFeatures;
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
