import { CardStat } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Spinner';
import { useDashboardQuery } from '@/hooks/api/useDashboard';
import type { OrgDashboard, StudentDashboard, TeacherDashboard } from '@/hooks/api/useDashboard';

function isOrg(d: { scope: string }): d is OrgDashboard {
  return d.scope === 'organization';
}

function isTeacher(d: { scope: string }): d is TeacherDashboard {
  return d.scope === 'teacher';
}

function isStudent(d: { scope: string }): d is StudentDashboard {
  return d.scope === 'student';
}

export function DashboardPage() {
  const { data, isLoading } = useDashboardQuery();

  if (isLoading || !data) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-8 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (isOrg(data)) {
    return (
      <div className="space-y-8 w-full">
        <PageHeader title="Dashboard" description="Organization overview" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardStat label="Teachers" value={data.totalTeachers} />
          <CardStat label="Students" value={data.totalStudents} />
          <CardStat label="Assessments" value={data.totalAssessments} hint={`${data.publishedAssessments} published`} />
          <CardStat label="Submissions this month" value={data.submissionsThisMonth} />
        </div>
      </div>
    );
  }

  if (isTeacher(data)) {
    return (
      <div className="space-y-8 w-full">
        <PageHeader title="Dashboard" description="Your assessments at a glance" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardStat label="Assessments created" value={data.totalAssessments} />
          <CardStat label="Published" value={data.publishedAssessments} />
          <CardStat label="Pending submissions" value={data.pendingSubmissions} />
          <CardStat label="Completed submissions" value={data.completedSubmissions} />
        </div>
      </div>
    );
  }

  if (isStudent(data)) {
    return (
      <div className="space-y-8 w-full">
        <PageHeader title="Dashboard" description="Your assessment progress" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardStat label="Assigned" value={data.assignedAssessments} />
          <CardStat label="Pending" value={data.pendingAssessments} />
          <CardStat label="Submitted" value={data.submittedAssessments} />
          <CardStat label="Average score" value={`${data.averageScorePercent}%`} />
        </div>
      </div>
    );
  }

  return null;
}
