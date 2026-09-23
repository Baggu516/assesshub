import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ClassMemberRow {
  id: string;
  email: string;
  label: string;
  hierarchyRole?: string;
  enrollmentId?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  description: string;
  academicYear: string;
  academicYearId: string | null;
  classMasterId: string | null;
  section: string;
  createdBy: string | null;
  isActive: boolean;
  teacherCount: number;
  studentCount: number;
  teachers?: ClassMemberRow[];
  students?: ClassMemberRow[];
  createdAt?: string;
  updatedAt?: string;
}

export function useClassesQuery(enabled = true, academicYearId?: string | null) {
  return useQuery({
    queryKey: ['classes', academicYearId || 'all'],
    enabled,
    queryFn: async () => {
      const params = academicYearId ? { academicYearId } : undefined;
      const { data } = await api.get<{ classes: SchoolClass[] }>('/classes', { params });
      return data.classes;
    },
  });
}

export function useClassQuery(classId?: string | null) {
  return useQuery({
    queryKey: ['classes', 'one', classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data } = await api.get<{ class: SchoolClass }>(`/classes/${classId}`);
      return data.class;
    },
  });
}

export function useClassOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: ['classes', 'options'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{
        teachers: ClassMemberRow[];
        students: ClassMemberRow[];
      }>('/classes/options');
      return data;
    },
  });
}

export function useClassMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['classes'] });
    qc.invalidateQueries({ queryKey: ['assessments', 'assignees'] });
  };

  const create = useMutation({
    mutationFn: async (body: {
      name?: string;
      description?: string;
      academicYearId: string;
      classMasterId: string;
      section?: string;
      teacherIds: string[];
      studentIds: string[];
    }) => {
      const { data } = await api.post<{ class: SchoolClass }>('/classes', body);
      return data.class;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string;
      academicYearId?: string;
      classMasterId?: string;
      section?: string;
      isActive?: boolean;
      teacherIds?: string[];
      studentIds?: string[];
    }) => {
      const { data } = await api.patch<{ class: SchoolClass }>(`/classes/${id}`, body);
      return data.class;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/classes/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
