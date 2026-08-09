import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  getCachedTenant,
  setCachedTenant,
  type CachedTenantOrganization,
} from '@/lib/sessionCache';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';

export type TenantOrganization = CachedTenantOrganization;

export async function fetchTenantOrganization(subdomain: string): Promise<TenantOrganization> {
  const { data } = await api.get<{ organization: TenantOrganization }>('/tenant/current');
  setCachedTenant(subdomain, data.organization);
  return data.organization;
}

export function updateTenantOrganizationCache(
  subdomain: string,
  organization: TenantOrganization,
  qc: QueryClient
) {
  setCachedTenant(subdomain, organization);
  qc.setQueryData(['tenant', subdomain], organization);
}

export function useTenantOrganization() {
  const { subdomain } = useTenant();
  const { user } = useAuth();
  const cached = subdomain ? getCachedTenant(subdomain) : null;

  return useQuery({
    queryKey: ['tenant', subdomain],
    enabled: Boolean(user && subdomain),
    queryFn: () => fetchTenantOrganization(subdomain),
    initialData: cached ?? undefined,
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useTenantOrganizationMutations() {
  const { subdomain } = useTenant();
  const qc = useQueryClient();

  const applyTenantUpdate = (organization: TenantOrganization) => {
    if (subdomain) updateTenantOrganizationCache(subdomain, organization, qc);
  };

  return { applyTenantUpdate, subdomain };
}
