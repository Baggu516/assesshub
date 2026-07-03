import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StudentGroupMember {
  id: string;
  email: string;
  label: string;
}

export interface StudentGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string | null;
  studentIds: string[];
  memberCount: number;
  members?: StudentGroupMember[];
  createdAt?: string;
  updatedAt?: string;
}

export function useStudentGroupsQuery() {
  return useQuery({
    queryKey: ['student-groups'],
    queryFn: async () => {
      const { data } = await api.get<{ groups: StudentGroup[] }>('/student-groups');
      return data.groups;
    },
  });
}

export function useStudentGroupMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['student-groups'] });

  const create = useMutation({
    mutationFn: async (body: { name: string; description?: string; studentIds: string[] }) => {
      const { data } = await api.post<{ group: StudentGroup }>('/student-groups', body);
      return data.group;
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
      studentIds?: string[];
    }) => {
      const { data } = await api.patch<{ group: StudentGroup }>(`/student-groups/${id}`, body);
      return data.group;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/student-groups/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
