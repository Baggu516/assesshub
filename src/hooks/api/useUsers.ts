import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserListRow {
  id: string;
  email: string;
  hierarchyRole: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  parentUserId?: string | null;
}

/** Cannot be granted to org line members by a lead (must match backend `ORG_LEVEL_PERMISSION_KEYS`). */
export const ORG_LEVEL_KEYS = new Set(['user_create', 'subordinate_create', 'settings_manage']);

export function usePermissionsCatalogQuery() {
  return useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: async () => {
      const { data } = await api.get<{ permissions: { key: string; label: string; description?: string }[] }>(
        '/permissions'
      );
      return data.permissions;
    },
  });
}

/** Include `viewerUserId` so cached lists do not bleed across accounts. */
export function useSubordinatesQuery(enabled = true, viewerUserId?: string) {
  return useQuery({
    queryKey: ['subordinates', viewerUserId],
    enabled: enabled && Boolean(viewerUserId),
    queryFn: async () => {
      const { data } = await api.get<{ subordinates: UserListRow[] }>('/users/subordinates-tree');
      return data.subordinates;
    },
  });
}

/** Include `viewerUserId` in the key so lists never bleed across accounts (e.g. admin cache vs subordinate). */
export function useUsersQuery(search: string, viewerUserId: string | undefined) {
  return useQuery({
    queryKey: ['users', search, viewerUserId],
    enabled: Boolean(viewerUserId),
    queryFn: async () => {
      const { data } = await api.get<{ users: UserListRow[]; total: number }>('/users', {
        params: { search },
      });
      return data;
    },
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const createSubordinate = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post('/users/subordinates', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subordinates'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const createMember = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/users/members', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const invite = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/users/invite', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const updateUser = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      (await api.patch(`/users/${id}`, body)).data as { user: UserListRow },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['subordinates'] });
    },
  });
  return { createSubordinate, createMember, invite, updateUser };
}
