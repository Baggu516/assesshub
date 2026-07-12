import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ClassMemberRow {
  id: string;
  email: string;
  label: string;
  hierarchyRole?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  description: string;
  academicYear: string;
  createdBy: string | null;
  isActive: boolean;
  teacherCount: number;
  studentCount: number;
  teachers?: ClassMemberRow[];
  students?: ClassMemberRow[];
  createdAt?: string;
  updatedAt?: string;
}

export function useClassesQuery(enabled = true) {
  return useQuery({
    queryKey: ['classes'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{ classes: SchoolClass[] }>('/classes');
      return data.classes;
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
      name: string;
      description?: string;
      academicYear?: string;
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
      academicYear?: string;
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
