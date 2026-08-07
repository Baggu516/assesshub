import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui';

type KbChunk = {
  id: string;
  chunkIndex: number;
  chunkKind: 'content' | 'summary' | 'synthetic_question';
  text: string;
};

function kindLabel(kind: KbChunk['chunkKind']) {
  switch (kind) {
    case 'summary':
      return 'Summary';
    case 'synthetic_question':
      return 'Question';
    default:
      return 'Content';
  }
}

function kindTone(kind: KbChunk['chunkKind']) {
  switch (kind) {
    case 'summary':
      return 'info' as const;
    case 'synthetic_question':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

type DocumentChunksProps = {
  documentId: string;
  enabled: boolean;
};

export function DocumentChunks({ documentId, enabled }: DocumentChunksProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kb-chunks', documentId],
    queryFn: async () => {
      const { data: res } = await api.get<{ chunks: KbChunk[] }>(`/kb/documents/${documentId}/chunks`);
      return res.chunks;
    },
    enabled,
  });

  if (!enabled) return null;

  if (isLoading) {
    return <p className="px-3 py-2 text-xs text-slate-500">Loading chunks…</p>;
  }

  if (isError) {
    return <p className="px-3 py-2 text-xs text-rose-600 dark:text-rose-400">Failed to load chunks</p>;
  }

  if (!data?.length) {
    return <p className="px-3 py-2 text-xs text-slate-500">No chunks yet</p>;
  }

  return (
    <ul className="mt-2 space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-700">
      {data.map((chunk) => (
        <li
          key={chunk.id}
          className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-900/50"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">#{chunk.chunkIndex + 1}</span>
            <Badge tone={kindTone(chunk.chunkKind)}>{kindLabel(chunk.chunkKind)}</Badge>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {chunk.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
