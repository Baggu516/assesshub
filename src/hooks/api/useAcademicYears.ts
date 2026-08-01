import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useAcademicYearsQuery(enabled = true) {
  return useQuery({
    queryKey: ['academic-years'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{ academicYears: AcademicYear[] }>('/academic-years');
      return data.academicYears;
    },
  });
}

export function useAcademicYearMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['academic-years'] });
    qc.invalidateQueries({ queryKey: ['classes'] });
  };

  const create = useMutation({
    mutationFn: async (body: {
      label: string;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
    }) => {
      const { data } = await api.post<{ academicYear: AcademicYear }>('/academic-years', body);
      return data.academicYear;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      label?: string;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
      isActive?: boolean;
    }) => {
      const { data } = await api.patch<{ academicYear: AcademicYear }>(`/academic-years/${id}`, body);
      return data.academicYear;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academic-years/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
