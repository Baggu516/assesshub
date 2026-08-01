import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PromotionStudentRow {
  studentId: string;
  studentLabel: string;
  email: string;
  enrollmentId: string;
  fromClassId: string | null;
  fromClassName: string;
  fromClassMasterId: string | null;
  fromSection: string;
  suggestedAction: 'promote' | 'retain';
  suggestedClassMasterId: string | null;
  suggestedClassMasterName: string | null;
  suggestedSection: string;
  suggestedTargetClassId: string | null;
  alreadyEnrolledInTarget: boolean;
}

export interface PromotionPreview {
  fromYear: { id: string; label: string };
  toYear: { id: string; label: string };
  targetClasses: {
    id: string;
    name: string;
    classMasterId: string | null;
    section: string;
  }[];
  classMasters: {
    id: string;
    name: string;
    nextClassMasterId: string | null;
  }[];
  students: PromotionStudentRow[];
}

export interface PromotionDecision {
  studentId: string;
  enrollmentId: string;
  action: 'promote' | 'retain' | 'skip';
  targetClassId?: string;
  classMasterId?: string;
  section?: string;
}

export function usePromotionMutations() {
  const qc = useQueryClient();

  const preview = useMutation({
    mutationFn: async (body: { fromAcademicYearId: string; toAcademicYearId: string }) => {
      const { data } = await api.post<PromotionPreview>('/promotions/preview', body);
      return data;
    },
  });

  const execute = useMutation({
    mutationFn: async (body: {
      fromAcademicYearId: string;
      toAcademicYearId: string;
      promotions: PromotionDecision[];
    }) => {
      const { data } = await api.post<{
        promoted: number;
        retained: number;
        skipped: number;
        errors: { studentId: string; error: string }[];
      }>('/promotions/execute', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });

  return { preview, execute };
}
