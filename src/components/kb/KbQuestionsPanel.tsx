import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Badge, Button, Card, EmptyState } from '@/components/ui';

type KbQuestion = {
  id: string;
  chatId: string;
  messageIndex: number;
  name: string;
  email: string;
  question: string;
  rag: boolean;
  sources: { documentId: string; title: string }[];
  feedback: 'up' | 'down' | null;
  feedbackAt: string | null;
  askedAt: string;
};

function formatAskedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function KbQuestionsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kb-questions'],
    queryFn: async () => {
      const { data: res } = await api.get<{ questions: KbQuestion[] }>('/kb/questions');
      return res.questions;
    },
  });

  const rechunkSources = useMutation({
    mutationFn: async (sources: { documentId: string; title: string }[]) => {
      const unique = [...new Map(sources.map((s) => [s.documentId, s])).values()];
      await Promise.all(unique.map((s) => api.post(`/kb/documents/${s.documentId}/reprocess`)));
      return unique.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['kb-documents'] });
      toast.success(`Re-chunking started for ${count} document(s)`);
    },
    onError: () => toast.error('Could not start re-chunking'),
  });

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Questions</h2>
      <p className="mt-1 text-xs text-slate-500">
        User questions, whether RAG was used, feedback, and actions to re-chunk source docs when answers were poor.
      </p>

      {isLoading && <p className="mt-4 text-sm text-slate-500">Loading questions…</p>}
      {isError && (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">Failed to load questions</p>
      )}

      {!isLoading && !isError && !data?.length && (
        <div className="mt-4">
          <EmptyState
            title="No questions yet"
            description="When users ask the dashboard AI, their questions will appear here with RAG and feedback."
          />
        </div>
      )}

      {!!data?.length && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Question</th>
                <th className="px-2 py-2 font-medium">RAG</th>
                <th className="px-2 py-2 font-medium">Feedback</th>
                <th className="px-2 py-2 font-medium">Asked</th>
                <th className="px-2 py-2 font-medium">Fix</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 align-top dark:border-slate-800"
                >
                  <td className="px-2 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{row.name}</div>
                    {row.email && <div className="text-xs text-slate-500">{row.email}</div>}
                  </td>
                  <td className="max-w-xl px-2 py-3 text-slate-700 dark:text-slate-300">
                    <p className="whitespace-pre-wrap break-words">{row.question}</p>
                    {row.sources?.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Sources: {row.sources.map((s) => s.title || s.documentId).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={row.rag ? 'success' : 'neutral'}>{row.rag ? 'Yes' : 'No'}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    {row.feedback === 'up' && <Badge tone="success">Helpful</Badge>}
                    {row.feedback === 'down' && <Badge tone="danger">Not helpful</Badge>}
                    {!row.feedback && <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-xs text-slate-500">
                    {formatAskedAt(row.askedAt)}
                  </td>
                  <td className="px-2 py-3">
                    {row.sources?.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={rechunkSources.isPending}
                        onClick={() => rechunkSources.mutate(row.sources)}
                      >
                        Re-chunk
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
