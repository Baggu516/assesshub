import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OrgDashboard = {
  scope: 'organization';
  totalTeachers: number;
  totalStudents: number;
  totalAssessments: number;
  publishedAssessments: number;
  submissionsThisMonth: number;
};

export type TeacherDashboard = {
  scope: 'teacher';
  totalAssessments: number;
  publishedAssessments: number;
  pendingSubmissions: number;
  completedSubmissions: number;
};

export type StudentDashboard = {
  scope: 'student';
  assignedAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  averageScorePercent: number;
};

export type DashboardData = OrgDashboard | TeacherDashboard | StudentDashboard;

export function useDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/reports/dashboard');
      return data;
    },
  });
}
