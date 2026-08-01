import type { HierarchyRole } from '@/types/user';

/** Stored on org `settings.sidebarLabels` — matches backend keys. */
export type OrgSidebarLabels = {
  dashboard?: string;
  subordinates?: string;
  /** Shown to admins for `/users` */
  users?: string;
  /** Shown to subordinate leads for `/users` (falls back to `users` if unset) */
  usersMember?: string;
  profile?: string;
  organization?: string;
  /** Nav item linking to `/settings` (key named settingsNav to avoid clashing with org.settings) */
  settingsNav?: string;
  knowledgeBase?: string;
  assessments?: string;
  myAssessments?: string;
  groupStudents?: string;
  classes?: string;
  academicYears?: string;
  classMasters?: string;
  promotions?: string;
};

const FALLBACK = {
  dashboard: 'Dashboard',
  subordinates: 'Teachers',
  users: 'Students',
  usersMember: 'My students',
  profile: 'Profile',
  organization: 'Organization',
  settingsNav: 'Settings',
  knowledgeBase: 'Knowledge base',
  assessments: 'Assessments',
  myAssessments: 'My assessments',
  groupStudents: 'Group students',
  classes: 'Classes',
  academicYears: 'Academic years',
  classMasters: 'Class masters',
  promotions: 'Promotions',
} as const;

export function resolveNavLabel(
  path: string,
  hierarchyRole: HierarchyRole | undefined,
  sidebarLabels: OrgSidebarLabels | undefined
): string {
  const sl = sidebarLabels ?? {};
  const t = (s: string | undefined, fb: string) => (s?.trim() ? s.trim() : fb);

  switch (path) {
    case '/':
      return t(sl.dashboard, FALLBACK.dashboard);
    case '/subordinates':
      return t(sl.subordinates, FALLBACK.subordinates);
    case '/users':
      if (hierarchyRole === 'admin') return t(sl.users, FALLBACK.users);
      return t(sl.usersMember, t(sl.users, FALLBACK.usersMember));
    case '/profile':
      return t(sl.profile, FALLBACK.profile);
    case '/organization':
      return t(sl.organization, FALLBACK.organization);
    case '/settings':
      return t(sl.settingsNav, FALLBACK.settingsNav);
    case '/knowledge-base':
      return t(sl.knowledgeBase, FALLBACK.knowledgeBase);
    case '/assessments':
      return t(sl.assessments, FALLBACK.assessments);
    case '/my-assessments':
      return t(sl.myAssessments, FALLBACK.myAssessments);
    case '/group-students':
      return t(sl.groupStudents, FALLBACK.groupStudents);
    case '/classes':
      return t(sl.classes, FALLBACK.classes);
    case '/academic-years':
      return t(sl.academicYears, FALLBACK.academicYears);
    case '/class-masters':
      return t(sl.classMasters, FALLBACK.classMasters);
    case '/promotions':
      return t(sl.promotions, FALLBACK.promotions);
    default:
      return path;
  }
}
