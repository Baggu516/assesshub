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
import { AssessmentBuilderPage } from './pages/AssessmentBuilderPage';
import { AssessmentResultsPage } from './pages/AssessmentResultsPage';
import { GroupStudentsPage } from './pages/GroupStudentsPage';
import { ClassesPage } from './pages/ClassesPage';
import { ClassWizardPage } from './pages/ClassWizardPage';
import { AcademicYearsPage } from './pages/AcademicYearsPage';
import { ClassMastersPage } from './pages/ClassMastersPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { MyAssessmentsPage } from './pages/MyAssessmentsPage';
import { TakeAssessmentPage } from './pages/TakeAssessmentPage';
import { LearningResourcesPage } from './pages/LearningResourcesPage';
import { useTenantOrganization } from './hooks/api/useTenant';
import { resolveOrgFeatures, type OrgFeatures } from './lib/sessionCache';
import { OrganizationPage } from './pages/OrganizationPage';
import { ClientsPage } from './pages/ClientsPage';
import { AppLayout } from './components/layout/AppLayout';
import { FullPageSpinner } from './components/ui/Spinner';
import { useTenant } from './context/TenantContext';

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

function RequireFeature({
  feature,
  children,
}: {
  feature: keyof OrgFeatures;
  children: React.ReactNode;
}) {
  const { data: org, isLoading } = useTenantOrganization();
  if (isLoading && !org) return <FullPageSpinner />;
  if (!resolveOrgFeatures(org)[feature]) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireMaster({ children }: { children: React.ReactNode }) {
  const { isMasterTenant } = useTenant();
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isMasterTenant || user.hierarchyRole !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/platform/login" element={<Navigate to="/login" replace />} />
      <Route path="/platform/*" element={<Navigate to="/clients" replace />} />
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
          path="clients"
          element={
            <RequireMaster>
              <ClientsPage />
            </RequireMaster>
          }
        />
        <Route
          path="users"
          element={
            <RequireHierarchy roles={['admin', 'subordinate']}>
              <RequirePermission keys={[PERMISSIONS.USER_CREATE, PERMISSIONS.ASSESSMENT_CREATE]}>
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
          path="classes"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <ClassesPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="classes/new"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <ClassWizardPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="classes/:classId/edit"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <ClassWizardPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="academic-years"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <AcademicYearsPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="class-masters"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <ClassMastersPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="promotions"
          element={
            <RequireHierarchy roles={['admin']}>
              <RequirePermission keys={[PERMISSIONS.CLASS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]}>
                <PromotionsPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="group-students"
          element={
            <RequireHierarchy roles={['subordinate']}>
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                <GroupStudentsPage />
              </RequirePermission>
            </RequireHierarchy>
          }
        />
        <Route
          path="worksheets"
          element={
            <RequireFeature feature="worksheets">
              <RequireHierarchy roles={['subordinate', 'user']}>
                <LearningResourcesPage kind="worksheet" />
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="assessments"
          element={
            <RequireFeature feature="assessments">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentsPage kind="assessment" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="assessments/new"
          element={
            <RequireFeature feature="assessments">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentBuilderPage kind="assessment" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="assessments/:assessmentId/edit"
          element={
            <RequireFeature feature="assessments">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentBuilderPage kind="assessment" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="assessments/:assessmentId/results"
          element={
            <RequireFeature feature="assessments">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentResultsPage kind="assessment" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="online-exams"
          element={
            <RequireFeature feature="onlineExams">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentsPage kind="online_exam" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="online-exams/new"
          element={
            <RequireFeature feature="onlineExams">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentBuilderPage kind="online_exam" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="online-exams/:assessmentId/edit"
          element={
            <RequireFeature feature="onlineExams">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentBuilderPage kind="online_exam" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="online-exams/:assessmentId/results"
          element={
            <RequireFeature feature="onlineExams">
              <RequireHierarchy roles={['subordinate']}>
                <RequirePermission keys={[PERMISSIONS.ASSESSMENT_CREATE]}>
                  <AssessmentResultsPage kind="online_exam" />
                </RequirePermission>
              </RequireHierarchy>
            </RequireFeature>
          }
        />
        <Route
          path="my-assessments"
          element={
            <RequireFeature feature="assessments">
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
                <MyAssessmentsPage kind="assessment" />
              </RequirePermission>
            </RequireFeature>
          }
        />
        <Route
          path="my-assessments/:assignmentId"
          element={
            <RequireFeature feature="assessments">
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
                <TakeAssessmentPage kind="assessment" />
              </RequirePermission>
            </RequireFeature>
          }
        />
        <Route
          path="my-online-exams"
          element={
            <RequireFeature feature="onlineExams">
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
                <MyAssessmentsPage kind="online_exam" />
              </RequirePermission>
            </RequireFeature>
          }
        />
        <Route
          path="my-online-exams/:assignmentId"
          element={
            <RequireFeature feature="onlineExams">
              <RequirePermission keys={[PERMISSIONS.ASSESSMENT_VIEW, PERMISSIONS.ASSESSMENT_SUBMIT]}>
                <TakeAssessmentPage kind="online_exam" />
              </RequirePermission>
            </RequireFeature>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
