import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PERMISSIONS } from './constants/permissions';
import type { HierarchyRole } from './types/user';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { SubordinatesPage } from './pages/SubordinatesPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { GroupStudentsPage } from './pages/GroupStudentsPage';
import { MyAssessmentsPage } from './pages/MyAssessmentsPage';
import { TakeAssessmentPage } from './pages/TakeAssessmentPage';
import { OrganizationPage } from './pages/OrganizationPage';
import { AppLayout } from './components/layout/AppLayout';
import { FullPageSpinner } from './components/ui/Spinner';
import { RequirePlatformAuth } from './pages/platform/RequirePlatformAuth';
import { PlatformLayout } from './pages/platform/PlatformLayout';
import { PlatformLoginPage } from './pages/platform/PlatformLoginPage';
import { PlatformOrganizationsPage } from './pages/platform/PlatformOrganizationsPage';
import { PlatformDashboardPage } from './pages/platform/PlatformDashboardPage';
import { PlatformUsersPage } from './pages/platform/PlatformUsersPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePermission({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const ok = keys.some((k) => user.permissions.includes(k as never));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireHierarchy({ roles, children }: { roles: HierarchyRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.hierarchyRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route
        path="/platform"
        element={
          <RequirePlatformAuth>
            <PlatformLayout />
          </RequirePlatformAuth>
        }
      >
        <Route index element={<PlatformDashboardPage />} />
        <Route path="orgs" element={<PlatformOrganizationsPage />} />
        <Route path="users" element={<PlatformUsersPage />} />
      </Route>
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="users"
          element={
            <RequireHierarchy roles={['subordinate']}>
              <RequirePermission keys={[PERMISSIONS.USER_CREATE]}>
                <UsersPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="subordinates"
          element={
            <RequirePermission keys={[PERMISSIONS.SUBORDINATE_CREATE]}>
              <SubordinatesPage />
            </RequirePermission>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="organization"
          element={
            <RequirePermission keys={[PERMISSIONS.SETTINGS_MANAGE]}>
              <OrganizationPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
            <RequirePermission keys={[PERMISSIONS.SETTINGS_MANAGE]}>
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route path="knowledge-base" element={<KnowledgeBasePage />} />
        <Route
          path="group-students"
          element={
            <RequireHierarchy roles={['subordinate']}>
              <RequirePermission keys={[PERMISSIONS.USER_CREATE]}>
                <GroupStudentsPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="assessments"
          element={
            <RequireHierarchy roles={['subordinate']}>
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                <AssessmentsPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="my-assessments"
          element={
            <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
              <MyAssessmentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="my-assessments/:assignmentId"
          element={
            <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
              <TakeAssessmentPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
