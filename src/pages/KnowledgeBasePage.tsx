import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge, Button, Card, EmptyState, PageHeader, Select } from '@/components/ui';
import { ChunkingSettings, type ChunkingConfig } from '@/components/kb/ChunkingSettings';
import { DocumentChunks } from '@/components/kb/DocumentChunks';
import { KbQuestionsPanel } from '@/components/kb/KbQuestionsPanel';

type EmbeddingProvider = 'ollama';

type KbConfig = ChunkingConfig & {
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
};

type KbDocument = {
  id: string;
  originalName: string;
  fileType: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  errorMessage?: string;
  extractedCharCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

type KbMeta = {
  enrichmentAvailable: boolean;
  embeddingProviders: EmbeddingProvider[];
  embeddingModels: Record<EmbeddingProvider, string[]>;
  providersAvailable: Record<EmbeddingProvider, boolean>;
};

const DEFAULT_CHUNKING: ChunkingConfig = {
  chunkingStrategy: 'semantic',
  chunkSize: 400,
  chunkOverlap: 80,
  syntheticQuestions: true,
  autoSummary: true,
  multiHopSearch: true,
};

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

export function KnowledgeBasePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [tab, setTab] = useState<'documents' | 'questions'>('documents');

  const { data, isLoading } = useQuery({
    queryKey: ['kb-config'],
    queryFn: async () => {
      const { data: res } = await api.get<{ config: KbConfig; meta: KbMeta }>('/kb/config');
      return res;
    },
    enabled: user?.hierarchyRole === 'admin',
  });

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ['kb-documents'],
    queryFn: async () => {
      const { data: res } = await api.get<{ documents: KbDocument[] }>('/kb/documents');
      return res.documents;
    },
    enabled: user?.hierarchyRole === 'admin',
    refetchInterval: (q) => {
      const docs = q.state.data as KbDocument[] | undefined;
      const busy = docs?.some((d) => d.status === 'pending' || d.status === 'processing');
      return busy ? 3000 : false;
    },
  });

  const [chunking, setChunking] = useState<ChunkingConfig>(DEFAULT_CHUNKING);
  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_EMBEDDING_MODEL);

  useEffect(() => {
    if (data?.config) {
      const c = data.config as ChunkingConfig & {
        sourceOnlyMode?: boolean;
        semanticSplitting?: boolean;
        targetTokens?: number;
        overlapTokens?: number;
        chunkingStrategy?: ChunkingConfig['chunkingStrategy'];
      };
      const strategy: ChunkingConfig['chunkingStrategy'] =
        c.chunkingStrategy === 'original' || c.chunkingStrategy === 'semantic'
          ? c.chunkingStrategy
          : c.sourceOnlyMode
            ? 'original'
            : c.semanticSplitting === false
              ? 'original'
              : 'semantic';
      setChunking({
        chunkingStrategy: strategy,
        chunkSize: c.chunkSize ?? c.targetTokens ?? DEFAULT_CHUNKING.chunkSize,
        chunkOverlap: c.chunkOverlap ?? c.overlapTokens ?? DEFAULT_CHUNKING.chunkOverlap,
        syntheticQuestions: c.syntheticQuestions ?? DEFAULT_CHUNKING.syntheticQuestions,
        autoSummary: c.autoSummary ?? DEFAULT_CHUNKING.autoSummary,
        multiHopSearch: c.multiHopSearch ?? DEFAULT_CHUNKING.multiHopSearch,
      });
      const options = data.meta.embeddingModels.ollama ?? [];
      const savedModel = data.config.embeddingModel;
      setEmbeddingModel(options.includes(savedModel) ? savedModel : options[0] ?? DEFAULT_EMBEDDING_MODEL);
    }
  }, [data]);

  const modelOptions = useMemo(() => data?.meta.embeddingModels.ollama ?? [], [data]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!(chunking.chunkSize > chunking.chunkOverlap) || chunking.chunkSize < 100) {
        throw Object.assign(new Error('Chunk size must be ≥ 100 and greater than overlap'), {
          response: { data: { error: 'Chunk size must be ≥ 100 and greater than overlap' } },
        });
      }
      return api.patch('/kb/config', {
        ...chunking,
        embeddingProvider: 'ollama',
        embeddingModel,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-config'] });
      toast.success('Knowledge base settings saved');
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax.response?.data?.error || ax.message || 'Save failed');
    },
  });

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/kb/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      refetchDocs();
      toast.success('Upload started — processing in background');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || 'Upload failed');
    },
  });

  const deleteDoc = useMutation({
    mutationFn: (id: string) => api.delete(`/kb/documents/${id}`),
    onSuccess: (_data, id) => {
      if (expandedDocId === id) setExpandedDocId(null);
      qc.removeQueries({ queryKey: ['kb-chunks', id] });
      refetchDocs();
      toast.success('Document removed');
    },
    onError: () => toast.error('Delete failed'),
  });

  const reprocessDoc = useMutation({
    mutationFn: (id: string) => api.post(`/kb/documents/${id}/reprocess`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['kb-chunks', id] });
      refetchDocs();
      toast.success('Reprocessing started');
    },
    onError: () => toast.error('Reprocess failed'),
  });

  const onFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadDoc.mutate(file);
    },
    [uploadDoc]
  );

  if (user?.hierarchyRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500">Loading knowledge base…</p>;
  }

  const providers = data.meta.providersAvailable;

  const docStatusTone = (s: KbDocument['status']) => {
    switch (s) {
      case 'ready':
        return 'success' as const;
      case 'failed':
        return 'danger' as const;
      case 'processing':
        return 'info' as const;
      default:
        return 'warning' as const;
    }
  };

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        title="Knowledge base"
        description="Upload PDF, DOCX, HTML, or TXT. Documents are chunked, embedded, and used by the dashboard AI for your organization."
      />

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab('documents')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'documents'
              ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-200'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          Documents
        </button>
        <button
          type="button"
          onClick={() => setTab('questions')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab === 'questions'
              ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-200'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          Questions
        </button>
      </div>

      {tab === 'questions' && <KbQuestionsPanel />}

      {tab === 'documents' && (
      <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          saveConfig.mutate();
        }}
      >
        <ChunkingSettings
          value={chunking}
          onChange={setChunking}
          enrichmentAvailable={data.meta.enrichmentAvailable}
        />

        <Card>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Embedding settings</h2>
          <p className="mt-1 text-xs text-slate-500">
            Vectors are generated locally with Ollama. Pull the model, then save.
          </p>
          <div className="mt-4 max-w-md">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Embedding model</span>
              <Select
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="mt-1"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="mt-4">
            <Button
              type="submit"
              disabled={
                saveConfig.isPending ||
                !providers.ollama ||
                !(chunking.chunkSize > chunking.chunkOverlap) ||
                chunking.chunkSize < 100
              }
            >
              {saveConfig.isPending ? 'Saving…' : 'Save settings'}
            </Button>
            {!providers.ollama && (
              <p className="mt-2 text-xs text-amber-600">
                Start Ollama and restart the backend, then save.
              </p>
            )}
          </div>
        </Card>
      </form>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Documents</h2>
        <label
          className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-10 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 transition-colors"
        >
          <svg className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {uploadDoc.isPending ? 'Uploading…' : 'Drop a file or click to upload'}
          </span>
          <span className="text-xs text-slate-500 mt-1">PDF, DOCX, HTML, TXT — max 12 MB</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.html,.htm,.txt"
            className="hidden"
            onChange={onFilePick}
            disabled={uploadDoc.isPending}
          />
        </label>

        <ul className="mt-4 space-y-2">
          {!docsData?.length && (
            <EmptyState
              title="No documents yet"
              description="Upload a file to build your organization knowledge base for AI answers."
            />
          )}
          {docsData?.map((doc) => {
            const expanded = expandedDocId === doc.id;
            return (
              <li
                key={doc.id}
                className="rounded-lg border border-slate-200/80 px-3 py-3 text-sm dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-white">
                      {doc.originalName}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{doc.fileType.toUpperCase()}</Badge>
                      <Badge tone={docStatusTone(doc.status)}>{doc.status}</Badge>
                      {doc.status === 'ready' && (
                        <span className="text-xs text-slate-500">{doc.chunkCount} chunks</span>
                      )}
                      {doc.status === 'failed' && doc.errorMessage && (
                        <span className="truncate text-xs text-rose-600 dark:text-rose-400">
                          {doc.errorMessage}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {doc.status === 'ready' && doc.chunkCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedDocId(expanded ? null : doc.id)}
                      >
                        {expanded ? 'Hide chunks' : 'Show chunks'}
                      </Button>
                    )}
                    {(doc.status === 'ready' || doc.status === 'failed') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => reprocessDoc.mutate(doc.id)}
                      >
                        Reprocess
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Delete this document and all its chunks?')) {
                          deleteDoc.mutate(doc.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <DocumentChunks documentId={doc.id} enabled={expanded && doc.status === 'ready'} />
              </li>
            );
          })}
        </ul>
      </Card>
      </>
      )}
    </div>
  );
}
