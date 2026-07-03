/** Must match backend `constants/permissions.js` keys. */
export const PERMISSIONS = {
  USER_CREATE: 'user_create',
  SUBORDINATE_CREATE: 'subordinate_create',
  SETTINGS_MANAGE: 'settings_manage',
  ASSESSMENT_CREATE: 'assessment_create',
  ASSESSMENT_VIEW: 'assessment_view',
  ASSESSMENT_SUBMIT: 'assessment_submit',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
