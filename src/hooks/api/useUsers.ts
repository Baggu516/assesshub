import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserListRow {
  id: string;
  email: string;
  registrationId?: string | null;
  hierarchyRole: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  parentUserId?: string | null;
  /** Present for teachers — classes they share with this student */
  classes?: { id: string; name: string; academicYear?: string }[];
}

/** Cannot be granted to org line members by a lead (must match backend `ORG_LEVEL_PERMISSION_KEYS`). */
export const ORG_LEVEL_KEYS = new Set([
  'user_create',
  'subordinate_create',
  'settings_manage',
  'class_manage',
]);

export function usePermissionsCatalogQuery() {
  return useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: async () => {
      const { data } = await api.get<{
        permissions: { key: string; label: string; description?: string; feature?: string | null; roles?: string[] }[];
      }>('/permissions');
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
export function useUsersQuery(
  search: string,
  viewerUserId: string | undefined,
  opts?: { page?: number; limit?: number }
) {
  const page = opts?.page;
  const limit = opts?.limit;
  return useQuery({
    queryKey: ['users', search, viewerUserId, page ?? null, limit ?? null],
    enabled: Boolean(viewerUserId),
    queryFn: async () => {
      const { data } = await api.get<{ users: UserListRow[]; total: number; page: number; limit: number }>(
        '/users',
        {
          params: {
            search,
            ...(page ? { page } : {}),
            ...(limit ? { limit } : {}),
          },
        }
      );
      return data;
    },
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const createSubordinate = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<{ user: UserListRow }>('/users/subordinates', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subordinates'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const createMember = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (
        await api.post<{ user: UserListRow; generatedPassword?: string }>('/users/members', body)
      ).data,
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
