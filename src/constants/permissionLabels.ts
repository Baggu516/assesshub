/** Human-readable labels for permission keys in the UI. */
export const PERMISSION_LABELS: Record<string, string> = {
  user_create: 'Create students',
  subordinate_create: 'Create teachers',
  assessment_create: 'Create assessments',
  assessment_view: 'View assessments',
  assessment_submit: 'Submit assessments',
  settings_manage: 'Manage settings',
};

export function formatPermissionList(keys: string[] | undefined): string {
  if (!keys?.length) return '—';
  return keys.map((k) => PERMISSION_LABELS[k] ?? k).join(', ');
}

/** Default permissions for teachers (subordinate role). */
export const TEACHER_PERMISSION_KEYS = [
  'user_create',
  'assessment_create',
  'assessment_view',
] as const;

/** Default permissions for students (user role). */
export const STUDENT_PERMISSION_KEYS = ['assessment_view', 'assessment_submit'] as const;
