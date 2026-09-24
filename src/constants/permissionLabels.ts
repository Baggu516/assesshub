import type { OrgFeatures } from '@/lib/sessionCache';

export type PermissionCatalogRow = {
  key: string;
  label: string;
  description?: string;
  feature?: string | null;
  roles?: string[];
};

/** True when this permission belongs to the role and the school's feature is on. */
export function permissionVisibleFor(
  row: PermissionCatalogRow,
  role: 'admin' | 'subordinate' | 'user',
  features: OrgFeatures
) {
  if (row.roles?.length && !row.roles.includes(role)) return false;
  if (!row.feature) return true;
  return features[row.feature as keyof OrgFeatures] === true;
}

/** Human-readable labels for permission keys in the UI. */
export const PERMISSION_LABELS: Record<string, string> = {
  user_create: 'Create students',
  subordinate_create: 'Create teachers',
  settings_manage: 'Manage settings',
  class_manage: 'Manage classes',
  assessment_create: 'Create assessments',
  assessment_view: 'View assessments',
  assessment_submit: 'Submit assessments',
  online_exam_create: 'Create online exams',
  online_exam_view: 'View online exams',
  online_exam_submit: 'Submit online exams',
  worksheet_manage: 'Manage worksheets',
  worksheet_view: 'View worksheets',
};

export function formatPermissionList(keys: string[] | undefined): string {
  if (!keys?.length) return '—';
  return keys.map((k) => PERMISSION_LABELS[k] ?? k).join(', ');
}

/** Default permissions for teachers (subordinate role). */
export const TEACHER_PERMISSION_KEYS = [
  'assessment_create',
  'assessment_view',
  'online_exam_create',
  'online_exam_view',
  'worksheet_manage',
  'worksheet_view',
] as const;

/** Default permissions for students (user role). */
export const STUDENT_PERMISSION_KEYS = [
  'assessment_view',
  'assessment_submit',
  'online_exam_view',
  'online_exam_submit',
  'worksheet_view',
] as const;
