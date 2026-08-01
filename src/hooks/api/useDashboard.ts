import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AcademicYearMeta = {
  id: string;
  label: string;
  isCurrent: boolean;
} | null;

export type OrgDashboard = {
  scope: 'organization';
  academicYear?: AcademicYearMeta;
  totalTeachers: number;
  totalStudents: number;
  totalAssessments: number;
  publishedAssessments: number;
  submissionsThisMonth: number;
};

export type TeacherDashboard = {
  scope: 'teacher';
  academicYear?: AcademicYearMeta;
  totalAssessments: number;
  publishedAssessments: number;
  pendingSubmissions: number;
  completedSubmissions: number;
};

export type StudentDashboard = {
  scope: 'student';
  academicYear?: AcademicYearMeta;
  assignedAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  averageScorePercent: number;
};

export type DashboardData = OrgDashboard | TeacherDashboard | StudentDashboard;

export function useDashboardQuery(academicYearId?: string) {
  return useQuery({
    queryKey: ['dashboard', academicYearId ?? 'current'],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/reports/dashboard', {
        params: academicYearId ? { academicYearId } : undefined,
      });
      return data;
    },
  });
}
