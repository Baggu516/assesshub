import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ResourceKind = 'worksheet';

export interface LearningResource {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string;
  classIds: string[];
  classNames: string[];
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  hasFile: boolean;
  startAt: string | null;
  endAt: string | null;
  dueAt: string | null;
  isPublished: boolean;
  isNotYetOpen: boolean;
  isClosed: boolean;
  createdAt?: string;
}

export function useLearningResourcesQuery(kind: ResourceKind) {
  return useQuery({
    queryKey: ['learning-resources', kind],
    queryFn: async () => {
      const { data } = await api.get<{ resources: LearningResource[] }>('/learning-resources', {
        params: { kind },
      });
      return data.resources;
    },
  });
}

function toFormData(input: {
  kind: ResourceKind;
  title: string;
  description: string;
  classIds: string[];
  startAt: string;
  endAt: string;
  dueAt: string;
  isPublished: boolean;
  file?: File | null;
}) {
  const fd = new FormData();
  fd.append('kind', input.kind);
  fd.append('title', input.title);
  fd.append('description', input.description);
  fd.append('classIds', JSON.stringify(input.classIds));
  fd.append('startAt', input.startAt);
  fd.append('endAt', input.endAt);
  fd.append('dueAt', input.dueAt);
  fd.append('isPublished', input.isPublished ? 'true' : 'false');
  if (input.file) fd.append('file', input.file);
  return fd;
}

export function useLearningResourceMutations(kind: ResourceKind) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['learning-resources', kind] });

  const create = useMutation({
    mutationFn: async (input: Parameters<typeof toFormData>[0]) => {
      const { data } = await api.post<{ resource: LearningResource }>('/learning-resources', toFormData(input));
      return data.resource;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: Parameters<typeof toFormData>[0] & { id: string }) => {
      const { data } = await api.patch<{ resource: LearningResource }>(
        `/learning-resources/${id}`,
        toFormData(input)
      );
      return data.resource;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/learning-resources/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export async function downloadLearningResource(id: string, fileName: string) {
  const res = await api.get(`/learning-resources/${id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  a.click();
  URL.revokeObjectURL(url);
}
