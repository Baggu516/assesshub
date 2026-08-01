import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type QuestionType = 'single_select' | 'multi_select' | 'short_answer';

export interface QuestionOption {
  id?: string;
  text: string;
  isCorrect?: boolean;
}

export interface AssessmentQuestion {
  id?: string;
  type: QuestionType;
  prompt: string;
  points: number;
  order: number;
  options: QuestionOption[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  createdBy: string | null;
  questions: AssessmentQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentAssignee {
  id: string;
  email: string;
  label: string;
  hierarchyRole: string;
}

export interface AssessmentAssignment {
  id: string;
  assessmentId: string;
  studentId: string;
  assignedBy: string;
  dueDate?: string | null;
  status: 'pending' | 'submitted';
  submittedAt?: string | null;
  score: number;
  maxScore: number;
  assessmentTitle?: string;
  assessmentStatus?: string;
  studentLabel?: string;
  studentEmail?: string;
  answers?: {
    questionId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
    isCorrect?: boolean;
    pointsEarned?: number;
  }[];
}

export function useAssessmentsQuery(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['assessments', 'list', params ?? {}],
    queryFn: async () => {
      const { data } = await api.get<{ assessments: Assessment[]; total: number }>('/assessments', {
        params,
      });
      return data;
    },
  });
}

export function useAssessmentQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['assessments', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<{ assessment: Assessment }>(`/assessments/${id}`);
      return data.assessment;
    },
  });
}

export function useAssessmentAssigneesQuery(enabled = true) {
  return useQuery({
    queryKey: ['assessments', 'assignees'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{ assignees: AssessmentAssignee[] }>('/assessments/assignees');
      return data.assignees;
    },
  });
}

export function useMyAssignmentsQuery() {
  return useQuery({
    queryKey: ['assessments', 'assignments', 'my'],
    queryFn: async () => {
      const { data } = await api.get<{ assignments: AssessmentAssignment[] }>(
        '/assessments/assignments/my'
      );
      return data.assignments;
    },
  });
}

export function useAssignmentQuery(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', 'assignments', assignmentId],
    enabled: Boolean(assignmentId),
    queryFn: async () => {
      const { data } = await api.get<{ assignment: AssessmentAssignment; assessment: Assessment }>(
        `/assessments/assignments/${assignmentId}`
      );
      return data;
    },
  });
}

export function useAssessmentResultsQuery(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', assessmentId, 'results'],
    enabled: Boolean(assessmentId),
    queryFn: async () => {
      const { data } = await api.get<{
        assessment: Assessment;
        results: AssessmentAssignment[];
      }>(`/assessments/${assessmentId}/results`);
      return data;
    },
  });
}

export function useAssessmentMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['assessments'] });
  };

  const create = useMutation({
    mutationFn: async (body: { title: string; description?: string; questions: AssessmentQuestion[] }) => {
      const { data } = await api.post<{ assessment: Assessment }>('/assessments', body);
      return data.assessment;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string;
      questions?: AssessmentQuestion[];
    }) => {
      const { data } = await api.patch<{ assessment: Assessment }>(`/assessments/${id}`, body);
      return data.assessment;
    },
    onSuccess: invalidate,
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ assessment: Assessment }>(`/assessments/${id}/publish`);
      return data.assessment;
    },
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: async ({
      id,
      studentIds,
      groupIds,
      dueDate,
    }: {
      id: string;
      studentIds?: string[];
      groupIds?: string[];
      dueDate?: string | null;
    }) => {
      const { data } = await api.post<{ assignments: AssessmentAssignment[] }>(
        `/assessments/${id}/assign`,
        {
          studentIds: studentIds || [],
          groupIds: groupIds || [],
          dueDate: dueDate || null,
        }
      );
      return data.assignments;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
    },
  });

  const submit = useMutation({
    mutationFn: async ({
      assignmentId,
      answers,
    }: {
      assignmentId: string;
      answers: {
        questionId: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
      }[];
    }) => {
      const { data } = await api.post(`/assessments/assignments/${assignmentId}/submit`, { answers });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
    },
  });

  return { create, update, publish, assign, submit };
}
