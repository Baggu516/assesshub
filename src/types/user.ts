import type { PermissionKey } from '@/constants/permissions';

export type HierarchyRole = 'admin' | 'subordinate' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hierarchyRole: HierarchyRole;
  parentUserId: string | null;
  permissions: PermissionKey[];
  orgId: string;
  roleId?: string | null;
}
