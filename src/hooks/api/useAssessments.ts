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
  section?: string;
  explanation?: string;
  options: QuestionOption[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
}

export type ExamKind = 'assessment' | 'online_exam';

export interface Assessment {
  id: string;
  kind?: ExamKind;
  title: string;
  description: string;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  negativeMarkPerWrong?: number;
  allowPartialCredit?: boolean;
  showAnswersAfterSubmit?: boolean;
  cameraMonitor?: boolean;
  sections?: string[];
  status: 'draft' | 'published' | 'closed';
  resultsReleased?: boolean;
  resultsReleasedAt?: string | null;
  createdBy: string | null;
  questions: AssessmentQuestion[];
  questionCount?: number;
  totalMarks?: number;
  assignmentCount?: number;
  submittedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentAssignee {
  id: string;
  email: string;
  label: string;
  hierarchyRole: string;
  classes?: { id: string; name: string; academicYear?: string }[];
}

export interface AssessmentAssignment {
  id: string;
  assessmentId: string;
  studentId: string;
  assignedBy: string;
  academicYearId?: string | null;
  academicYearLabel?: string | null;
  dueDate?: string | null;
  status: 'pending' | 'submitted';
  startedAt?: string | null;
  expiresAt?: string | null;
  remainingSeconds?: number | null;
  submitReason?: 'manual' | 'timer' | 'fullscreen_exits' | null;
  fullscreenExitCount?: number;
  maxFullscreenExits?: number;
  submittedAt?: string | null;
  score: number | null;
  maxScore: number;
  assessmentTitle?: string;
  assessmentDescription?: string;
  assessmentStatus?: string;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  questionCount?: number;
  totalMarks?: number;
  resultsReleased?: boolean;
  resultsVisible?: boolean;
  resultsHidden?: boolean;
  studentLabel?: string;
  studentName?: string;
  studentEmail?: string;
  scoredMarks?: number;
  percentage?: number;
  correctCount?: number;
  partialCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  timeTakenSeconds?: number | null;
  autoSubmitted?: boolean;
  answers?: {
    questionId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
    isCorrect?: boolean;
    pointsEarned?: number;
  }[];
}

export interface AssessmentResultsSummary {
  assigned: number;
  submitted: number;
  pending: number;
  averagePercentage: number;
  highestPercentage: number;
  pendingReleaseCount?: number;
}

export type AssessmentPayload = {
  title: string;
  description?: string;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  negativeMarkPerWrong?: number;
  allowPartialCredit?: boolean;
  showAnswersAfterSubmit?: boolean;
  cameraMonitor?: boolean;
  sections?: string[];
  questions: AssessmentQuestion[];
  kind?: ExamKind;
};

export function useAssessmentsQuery(params?: { status?: string; page?: number; kind?: ExamKind }) {
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

/** academicYearId: specific id, "all", or omit for current year */
export function useMyAssignmentsQuery(academicYearId?: string, kind?: ExamKind) {
  return useQuery({
    queryKey: ['assessments', 'assignments', 'my', academicYearId ?? 'current', kind ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<{
        assignments: AssessmentAssignment[];
        academicYear: { id: string; label: string; isCurrent: boolean } | null;
      }>('/assessments/assignments/my', {
        params: {
          ...(academicYearId ? { academicYearId } : {}),
          ...(kind ? { kind } : {}),
        },
      });
      return data;
    },
  });
}

export async function uploadProctorCapture(assignmentId: string, image: string) {
  await api.post(`/assessments/assignments/${assignmentId}/captures`, { image });
}

export async function recordFullscreenExit(assignmentId: string) {
  const { data } = await api.post<{
    fullscreenExitCount: number;
    maxFullscreenExits: number;
    exitsRemaining: number;
    forceSubmit: boolean;
  }>(`/assessments/assignments/${assignmentId}/fullscreen-exit`);
  return data;
}

export function useAssignmentQuery(assignmentId: string | undefined, options?: { preview?: boolean }) {
  const preview = Boolean(options?.preview);
  return useQuery({
    queryKey: ['assessments', 'assignments', assignmentId, preview ? 'preview' : 'live'],
    enabled: Boolean(assignmentId),
    placeholderData: (previous) => {
      if (!previous || previous.assignment.id !== assignmentId) return undefined;
      return previous;
    },
    queryFn: async () => {
      const { data } = await api.get<{ assignment: AssessmentAssignment; assessment: Assessment }>(
        `/assessments/assignments/${assignmentId}`,
        { params: preview ? { preview: '1' } : undefined }
      );
      return data;
    },
  });
}

export function useAssessmentResultsQuery(assessmentId: string | undefined, academicYearId?: string) {
  return useQuery({
    queryKey: ['assessments', assessmentId, 'results', academicYearId ?? 'current'],
    enabled: Boolean(assessmentId),
    queryFn: async () => {
      const { data } = await api.get<{
        assessment: Assessment;
        academicYear: { id: string; label: string; isCurrent: boolean } | null;
        summary: AssessmentResultsSummary;
        results: AssessmentAssignment[];
      }>(`/assessments/${assessmentId}/results`, {
        params: academicYearId ? { academicYearId } : undefined,
      });
      return data;
    },
  });
}

export interface AssessmentAssignmentSummary {
  academicYear: { id: string; label: string; isCurrent: boolean } | null;
  assignedStudentIds: string[];
  assignedGroupIds: string[];
  assignedGroups: { id: string; name: string }[];
  totalAssigned: number;
  dueDate: string | null;
}

export function useAssessmentAssignmentSummaryQuery(
  assessmentId: string | undefined,
  academicYearId?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['assessments', assessmentId, 'assignment-summary', academicYearId ?? 'current'],
    enabled: Boolean(assessmentId) && enabled,
    queryFn: async () => {
      const { data } = await api.get<AssessmentAssignmentSummary>(
        `/assessments/${assessmentId}/assignment-summary`,
        {
          params: academicYearId ? { academicYearId } : undefined,
        }
      );
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
    mutationFn: async (body: AssessmentPayload) => {
      const { data } = await api.post<{ assessment: Assessment }>('/assessments', body);
      return data.assessment;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: Partial<AssessmentPayload> & { id: string }) => {
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

  const unpublish = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ assessment: Assessment }>(`/assessments/${id}/unpublish`);
      return data.assessment;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assessments/${id}`);
    },
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: async ({
      id,
      studentIds,
      groupIds,
      dueDate,
      academicYearId,
    }: {
      id: string;
      studentIds?: string[];
      groupIds?: string[];
      dueDate?: string | null;
      academicYearId?: string;
    }) => {
      const { data } = await api.post<{ assignments: AssessmentAssignment[] }>(
        `/assessments/${id}/assign`,
        {
          studentIds: studentIds || [],
          groupIds: groupIds || [],
          dueDate: dueDate || null,
          academicYearId: academicYearId || undefined,
        }
      );
      return data.assignments;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const reattempt = useMutation({
    mutationFn: async ({
      assessmentId,
      assignmentId,
    }: {
      assessmentId: string;
      assignmentId: string;
    }) => {
      const { data } = await api.post(
        `/assessments/${assessmentId}/results/${assignmentId}/reattempt`
      );
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['assessments', vars.assessmentId, 'results'] });
      invalidate();
    },
  });

  const hideResult = useMutation({
    mutationFn: async ({
      assessmentId,
      assignmentId,
      hidden,
    }: {
      assessmentId: string;
      assignmentId: string;
      hidden: boolean;
    }) => {
      const { data } = await api.post(
        `/assessments/${assessmentId}/results/${assignmentId}/hide`,
        { hidden }
      );
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['assessments', vars.assessmentId, 'results'] });
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
      invalidate();
    },
  });

  const deleteResult = useMutation({
    mutationFn: async ({
      assessmentId,
      assignmentId,
    }: {
      assessmentId: string;
      assignmentId: string;
    }) => {
      await api.delete(`/assessments/${assessmentId}/results/${assignmentId}`);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['assessments', vars.assessmentId, 'results'] });
      invalidate();
    },
  });

  const releaseResults = useMutation({
    mutationFn: async (assessmentId: string) => {
      const { data } = await api.post<{
        message: string;
        assessment: Assessment;
        notify: { recipients: number; emailed: number; skipped: number; failed: number };
        summary: { pendingReleaseCount: number };
      }>(`/assessments/${assessmentId}/release-results`);
      return data;
    },
    onSuccess: (_d, assessmentId) => {
      qc.invalidateQueries({ queryKey: ['assessments', assessmentId, 'results'] });
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
      invalidate();
    },
  });

  const submit = useMutation({
    mutationFn: async ({
      assignmentId,
      answers,
      submitReason,
    }: {
      assignmentId: string;
      answers: {
        questionId: string;
        selectedOptionIds?: string[];
        textAnswer?: string;
      }[];
      submitReason?: 'manual' | 'timer' | 'fullscreen_exits';
    }) => {
      const { data } = await api.post(`/assessments/assignments/${assignmentId}/submit`, {
        answers,
        submitReason: submitReason || 'manual',
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessments', 'assignments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return {
    create,
    update,
    publish,
    unpublish,
    remove,
    assign,
    reattempt,
    hideResult,
    deleteResult,
    releaseResults,
    submit,
  };
}
