import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ClassMaster {
  id: string;
  name: string;
  description: string;
  nextClassMasterId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useClassMastersQuery(enabled = true) {
  return useQuery({
    queryKey: ['class-masters'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{ classMasters: ClassMaster[] }>('/class-masters');
      return data.classMasters;
    },
  });
}

export function useClassMasterMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['class-masters'] });
    qc.invalidateQueries({ queryKey: ['classes'] });
  };

  const create = useMutation({
    mutationFn: async (body: {
      name: string;
      description?: string;
      nextClassMasterId?: string | null;
      sortOrder?: number;
    }) => {
      const { data } = await api.post<{ classMaster: ClassMaster }>('/class-masters', body);
      return data.classMaster;
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
      nextClassMasterId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }) => {
      const { data } = await api.patch<{ classMaster: ClassMaster }>(`/class-masters/${id}`, body);
      return data.classMaster;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/class-masters/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
