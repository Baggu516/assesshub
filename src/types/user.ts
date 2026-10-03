import type { PermissionKey } from '@/constants/permissions';

export type HierarchyRole = 'admin' | 'subordinate' | 'user';

export type StudentAccessStatus =
  | 'trial'
  | 'active'
  | 'expired'
  | 'pending'
  | 'exempt'
  | 'suspended'
  | 'waived';

export interface StudentAccess {
  required: boolean;
  status: StudentAccessStatus;
  locked: boolean;
  daysLeft: number | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  planId?: 'monthly' | 'quarterly' | 'yearly' | null;
  suspended?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  registrationId?: string | null;
  firstName: string;
  lastName: string;
  hierarchyRole: HierarchyRole;
  parentUserId: string | null;
  permissions: PermissionKey[];
  orgId: string;
  roleId?: string | null;
  /** Present for student accounts. */
  access?: StudentAccess;
}
