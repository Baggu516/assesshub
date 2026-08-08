import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Card, Select } from '@/components/ui';

const OLLAMA_MODEL_STORAGE_KEY = 'ah_dashboard_ai_ollama_model';
const ACTIVE_CHAT_STORAGE_KEY = 'ah_dashboard_ai_chat_id';

type OllamaModelOption = { id: string; label: string; role?: string };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  sentAt?: string;
  feedback?: 'up' | 'down';
  knowledgeBaseUsed?: boolean;
};

type ChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type ChatDetail = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type ProvidersState = {
  gemini: boolean;
  groq: boolean;
  ollama: boolean;
  ollamaModels: OllamaModelOption[];
} | null;

type KnowledgeStatus = {
  available: boolean;
  readyDocuments: number;
  chunkCount: number;
  embeddingProvider: string | null;
};

function formatListTime(iso: string) {
  try {
    const d = new Date(iso);
    const day = d.toLocaleString(undefined, { day: 'numeric', month: 'short' });
    const time = d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${day} • ${time}`;
  } catch {
    return '';
  }
}

function formatMessageTime(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const EXAMPLE_PROMPTS = [
  'What should I focus on this week?',
  'Summarize my pending assessments.',
  'How are student submissions trending?',
];

function ChatLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

type DashboardAiChatProps = {
  variant?: 'embedded' | 'widget';
  onClose?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export function DashboardAiChat({
  variant = 'embedded',
  onClose,
  expanded = false,
  onToggleExpand,
}: DashboardAiChatProps) {
  const isWidget = variant === 'widget';
  const [providers, setProviders] = useState<ProvidersState>(null);
  const [ollamaModel, setOllamaModel] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY) || '';
  });
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kbStatus, setKbStatus] = useState<KnowledgeStatus | null>(null);
  const [lastKbUsed, setLastKbUsed] = useState(false);
  const [lastIntent, setLastIntent] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshChatList = useCallback(async () => {
    const { data } = await api.get<{ chats: ChatSummary[] }>('/ai/chats');
    setChats(data.chats);
    return data.chats;
  }, []);

  const stampMessages = (msgs: ChatMessage[], updatedAt?: string): ChatMessage[] => {
    if (!msgs.length) return msgs;
    const lastAt = updatedAt ?? new Date().toISOString();
    return msgs.map((m, i) => ({
      ...m,
      sentAt: m.sentAt ?? (i === msgs.length - 1 ? lastAt : undefined),
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [provRes, kbRes] = await Promise.all([
          api.get<{
            gemini: boolean;
            groq: boolean;
            ollama?: boolean;
            ollamaModels?: OllamaModelOption[];
          }>('/ai/providers'),
          api.get<KnowledgeStatus>('/ai/knowledge-status'),
        ]);
        if (!cancelled) {
          setProviders({
            gemini: Boolean(provRes.data.gemini),
            groq: Boolean(provRes.data.groq),
            ollama: Boolean(provRes.data.ollama),
            ollamaModels: provRes.data.ollamaModels ?? [],
          });
          setKbStatus(kbRes.data);
        }
      } catch {
        if (!cancelled) {
          setProviders({ gemini: false, groq: false, ollama: false, ollamaModels: [] });
          setKbStatus(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ollamaModel) localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, ollamaModel);
  }, [ollamaModel]);

  useEffect(() => {
    if (!providers?.ollamaModels?.length) return;
    const ids = providers.ollamaModels.map((m) => m.id);
    if (!ollamaModel || !ids.includes(ollamaModel)) {
      setOllamaModel(providers.ollamaModels[0].id);
    }
  }, [providers, ollamaModel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setError(null);
      try {
        const list = await refreshChatList();
        if (cancelled) return;
        const stored =
          typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) : null;
        const preferred = stored && list.some((c) => c.id === stored) ? stored : list[0]?.id ?? null;
        setActiveChatId(preferred);
        if (preferred) {
          setChatLoading(true);
          try {
            const { data } = await api.get<{ chat: ChatDetail }>(`/ai/chats/${preferred}`);
            if (!cancelled) {
              setMessages(stampMessages(data.chat.messages, data.chat.updatedAt));
              localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, preferred);
            }
          } finally {
            if (!cancelled) setChatLoading(false);
          }
        } else {
          setMessages([]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const ax = e as { response?: { data?: { error?: string } } };
          setError(ax.response?.data?.error || 'Could not load chats.');
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshChatList]);

  const selectChat = useCallback(
    async (id: string) => {
      if (id === activeChatId) return;
      setActiveChatId(id);
      setError(null);
      setChatLoading(true);
      try {
        const { data } = await api.get<{ chat: ChatDetail }>(`/ai/chats/${id}`);
        setMessages(stampMessages(data.chat.messages, data.chat.updatedAt));
        localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, id);
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { error?: string } } };
        setError(ax.response?.data?.error || 'Could not open chat.');
      } finally {
        setChatLoading(false);
      }
    },
    [activeChatId]
  );

  const newChat = useCallback(async () => {
    setCreatingChat(true);
    setError(null);
    try {
      const { data } = await api.post<{ chat: ChatDetail }>('/ai/chats');
      const chat = data.chat;
      setChats((prev) => [
        { id: chat.id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt, messageCount: 0 },
        ...prev.filter((c) => c.id !== chat.id),
      ]);
      setActiveChatId(chat.id);
      setMessages([]);
      localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, chat.id);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Could not create chat.');
    } finally {
      setCreatingChat(false);
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string, e?: MouseEvent) => {
      e?.stopPropagation();
      if (!window.confirm('Delete this chat and its messages?')) return;
      try {
        await api.delete(`/ai/chats/${id}`);
        const nextList = await refreshChatList();
        if (activeChatId === id) {
          const nextId = nextList[0]?.id ?? null;
          setActiveChatId(nextId);
          if (nextId) {
            const { data } = await api.get<{ chat: ChatDetail }>(`/ai/chats/${nextId}`);
            setMessages(stampMessages(data.chat.messages, data.chat.updatedAt));
            localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, nextId);
          } else {
            setMessages([]);
            localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
          }
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { error?: string } } };
        setError(ax.response?.data?.error || 'Could not delete chat.');
      }
    },
    [activeChatId, refreshChatList]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const sendFeedback = useCallback(
    async (messageIndex: number, rating: 'up' | 'down') => {
      if (!activeChatId || loading) return;
      const current = messages[messageIndex];
      if (!current || current.role !== 'assistant') return;
      if (current.feedback === rating) return;

      setMessages((prev) =>
        prev.map((m, i) => (i === messageIndex ? { ...m, feedback: rating } : m))
      );

      try {
        const { data } = await api.post<{
          chat: ChatDetail;
          reprocessed?: { documentId: string; originalName: string }[];
        }>(`/ai/chats/${activeChatId}/feedback`, { messageIndex, rating });
        setMessages(stampMessages(data.chat.messages, data.chat.updatedAt));
        if (rating === 'up') {
          toast.success('Thanks for the feedback');
        } else if (data.reprocessed?.length) {
          toast.success(
            `Marked not helpful — re-chunking ${data.reprocessed.length} related doc(s)`
          );
        } else {
          toast.success('Marked not helpful — noted for review');
        }
      } catch {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === messageIndex ? { ...m, feedback: current.feedback } : m
          )
        );
        toast.error('Could not save feedback');
      }
    },
    [activeChatId, loading, messages]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !activeChatId) return;

    const prevMessages = messages;
    const now = new Date().toISOString();
    const optimistic: ChatMessage[] = [...messages, { role: 'user', content: text, sentAt: now }];
    setInput('');
    setError(null);
    setMessages(optimistic);
    setLoading(true);

    try {
      const { data } = await api.post<{
        message: ChatMessage;
        chat: ChatDetail;
        knowledgeBaseUsed?: boolean;
        chatIntent?: string;
      }>(`/ai/chats/${activeChatId}/reply`, {
        provider: 'ollama',
        content: text,
        ...(ollamaModel ? { model: ollamaModel } : {}),
      });
      const stamped = stampMessages(data.chat.messages, data.chat.updatedAt);
      setMessages(stamped);
      setLastKbUsed(Boolean(data.knowledgeBaseUsed));
      setLastIntent(data.chatIntent ?? null);
      setChats((prev) => {
        const rest = prev.filter((c) => c.id !== data.chat.id);
        const summary: ChatSummary = {
          id: data.chat.id,
          title: data.chat.title,
          createdAt: data.chat.createdAt,
          updatedAt: data.chat.updatedAt,
          messageCount: data.chat.messages.length,
        };
        return [summary, ...rest].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string }; status?: number } };
      const msg =
        ax.response?.data?.error ||
        (ax.response?.status === 503 ? 'This AI provider is not configured on the server.' : null) ||
        'Request failed. Try again.';
      setError(msg);
      setMessages(prevMessages);
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, ollamaModel, activeChatId]);

  const configured = providers ? providers.ollama : true;
  const noneConfigured = Boolean(providers && !providers.ollama);

  const kbInfo = kbStatus?.available
    ? `${kbStatus.readyDocuments} docs · ${kbStatus.chunkCount} chunks indexed`
    : 'Upload docs in Knowledge base for richer answers';

  const lastUserIndex = messages.reduce((acc, m, i) => (m.role === 'user' ? i : acc), -1);

  if (isWidget) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-950">
        <div
          className="pointer-events-none absolute inset-0 bg-mesh-light opacity-70 dark:bg-mesh-dark dark:opacity-100"
          aria-hidden
        />

        <header className="relative shrink-0 border-b border-brand-100/80 px-4 py-3.5 dark:border-slate-800/80">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-600 text-white shadow-glow">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" aria-hidden />
                <ChatLogoIcon className="relative h-5 w-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    AI Assistant
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowInfo((s) => !s)}
                    className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25"
                  >
                    Info
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your intelligent workflow companion</p>
                {showInfo && (
                  <p className="mt-2 animate-fade-in rounded-xl bg-white/70 px-2.5 py-2 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200/70 backdrop-blur-sm dark:bg-slate-900/70 dark:ring-slate-700/70">
                    Private chats · workload + org knowledge · {kbInfo}
                    {lastIntent && (
                      <span className="mt-1 block font-medium text-brand-700 dark:text-brand-300">
                        Last mode: {lastIntent.replace(/_/g, ' ')}
                        {lastKbUsed ? ' · KB used' : ''}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {(providers?.ollamaModels?.length ?? 0) > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="hidden sm:inline">Model</span>
                  <Select
                    inputSize="sm"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="min-w-[7rem] rounded-xl border-slate-200/90 bg-white/80 text-sm shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/80"
                  >
                    {providers!.ollamaModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {onToggleExpand && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  title={expanded ? 'Restore size' : 'Expand to 60%'}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/80 hover:text-brand-700 dark:hover:bg-slate-800 dark:hover:text-brand-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                  </svg>
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </header>

        {(noneConfigured || error || (!noneConfigured && providers && !configured)) && (
          <div className="relative shrink-0 space-y-1.5 px-4 py-2.5">
            {noneConfigured && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
                Start Ollama and restart the backend to enable chat.
              </p>
            )}
            {!noneConfigured && providers && !configured && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
                Ollama is not available on the server.
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200/80 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          <aside className="flex w-44 shrink-0 flex-col border-r border-slate-200/70 bg-white/40 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/40 sm:w-52">
            <div className="p-3">
              <button
                type="button"
                onClick={() => void newChat()}
                disabled={creatingChat || listLoading || noneConfigured}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-600 px-3 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:from-brand-400 hover:to-cyan-500 disabled:opacity-50"
              >
                <span className="text-lg leading-none">+</span>
                {creatingChat ? 'Creating…' : 'New Chat'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
              {listLoading ? (
                <p className="px-2 text-xs text-slate-500">Loading…</p>
              ) : chats.length === 0 ? (
                <div className="mx-1 mt-2 rounded-xl border border-dashed border-slate-200/90 px-3 py-6 text-center dark:border-slate-700/80">
                  <p className="text-xs font-medium text-slate-500">No chats yet</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Start fresh anytime</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {chats.map((c) => {
                    const active = c.id === activeChatId;
                    return (
                      <li key={c.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => void selectChat(c.id)}
                          className={clsx(
                            'w-full rounded-xl py-2.5 pl-3 pr-7 text-left transition-all',
                            active
                              ? 'bg-brand-50 shadow-sm ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:ring-brand-500/25'
                              : 'hover:bg-white/70 dark:hover:bg-slate-800/50'
                          )}
                        >
                          <span
                            className={clsx(
                              'block truncate text-sm font-medium',
                              active ? 'text-brand-900 dark:text-brand-100' : 'text-slate-700 dark:text-slate-300'
                            )}
                          >
                            {c.title}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-500">{formatListTime(c.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={(ev) => void deleteChat(c.id, ev)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-50/90 to-cyan-50/60 p-3 ring-1 ring-brand-100/80 dark:from-brand-500/10 dark:to-cyan-500/5 dark:ring-brand-500/20">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-brand-600 shadow-sm dark:bg-slate-900/60 dark:text-brand-300">
                  <SparkleIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Always on</p>
                  <p className="text-[10px] text-slate-500">Ready when you are</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {listLoading ? (
              <p className="m-auto text-sm text-slate-500">Loading…</p>
            ) : !activeChatId ? (
              <div className="m-auto flex max-w-sm animate-fade-up flex-col items-center gap-4 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-600 shadow-soft ring-1 ring-brand-100 dark:from-brand-500/15 dark:to-cyan-500/10 dark:text-brand-300 dark:ring-brand-500/25">
                  <SparkleIcon className="h-7 w-7" />
                </span>
                <div>
                  <p className="font-display text-base font-bold text-slate-800 dark:text-slate-100">Start a conversation</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    Ask about assessments, students, or your knowledge base.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void newChat()}
                  disabled={creatingChat || noneConfigured}
                  className="rounded-xl bg-gradient-to-br from-brand-500 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:from-brand-400 hover:to-cyan-500 disabled:opacity-50"
                >
                  + New Chat
                </button>
              </div>
            ) : chatLoading ? (
              <p className="m-auto text-sm text-slate-500">Opening chat…</p>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
                  {messages.length === 0 && !loading && (
                    <div className="flex h-full animate-fade-up flex-col items-center justify-center gap-5 py-8">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-600 ring-1 ring-brand-100 dark:from-brand-500/15 dark:to-cyan-500/10 dark:text-brand-300 dark:ring-brand-500/25">
                        <ChatLogoIcon className="h-6 w-6" />
                      </span>
                      <div className="text-center">
                        <p className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">How can I help?</p>
                        <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
                          Ask about assessments, students, or your knowledge base.
                        </p>
                      </div>
                      <div className="flex w-full max-w-sm flex-col gap-2">
                        {EXAMPLE_PROMPTS.map((prompt, idx) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => setInput(prompt)}
                            style={{ animationDelay: `${idx * 60}ms` }}
                            className="animate-fade-up rounded-xl bg-white/80 px-3.5 py-2.5 text-left text-xs font-medium text-slate-600 shadow-soft ring-1 ring-slate-200/80 transition-all hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700/80 dark:hover:bg-brand-500/10 dark:hover:text-brand-200 dark:hover:ring-brand-500/30"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const isLastUser = i === lastUserIndex;
                    const time = formatMessageTime(m.sentAt);

                    if (isUser) {
                      return (
                        <div key={`${i}-user`} className="flex animate-msg-in flex-col items-end gap-1">
                          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-cyan-600 px-4 py-2.5 text-sm text-white shadow-glow">
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          </div>
                          <div className="flex items-center gap-1.5 pr-1">
                            {time && <span className="text-[10px] text-slate-400">{time}</span>}
                            {isLastUser && !loading && (
                              <svg
                                className="h-3.5 w-3.5 text-brand-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                aria-hidden
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l2 2 6-6" opacity={0.5} />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={`${i}-assistant`} className="flex animate-msg-in items-start gap-2.5">
                        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-600 ring-1 ring-brand-100 dark:from-brand-500/20 dark:to-cyan-500/10 dark:text-brand-300 dark:ring-brand-500/25">
                          <ChatLogoIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 max-w-[90%]">
                          <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-soft ring-1 ring-slate-200/80 backdrop-blur-sm dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700/80">
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-slate-100/90 pt-2 dark:border-slate-800">
                              <button
                                type="button"
                                title="Copy"
                                onClick={() => void copyText(m.content)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Helpful"
                                onClick={() => void sendFeedback(i, 'up')}
                                className={clsx(
                                  'rounded-lg p-1.5 transition-colors',
                                  m.feedback === 'up'
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                                    : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10'
                                )}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Not helpful — re-chunk related docs"
                                onClick={() => void sendFeedback(i, 'down')}
                                className={clsx(
                                  'rounded-lg p-1.5 transition-colors',
                                  m.feedback === 'down'
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                                    : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10'
                                )}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.007L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                                  />
                                </svg>
                              </button>
                              {time && <span className="ml-1 text-[10px] text-slate-400">{time}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {loading && (
                    <div className="flex animate-msg-in items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-cyan-50 text-brand-600 ring-1 ring-brand-100 dark:from-brand-500/20 dark:to-cyan-500/10 dark:text-brand-300">
                        <ChatLogoIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3.5 shadow-soft ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-700/80">
                        <span className="inline-flex gap-1.5 text-brand-400">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="shrink-0 border-t border-slate-200/70 bg-white/50 p-3 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/40">
                  <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80 transition-shadow focus-within:shadow-glow focus-within:ring-brand-300/60 dark:bg-slate-900 dark:ring-slate-700/80 dark:focus-within:ring-brand-500/40">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={1}
                      placeholder="Message… (Enter to send)"
                      disabled={loading || !configured || noneConfigured || !activeChatId}
                      className="max-h-24 min-h-[2.5rem] w-full resize-none rounded-t-2xl bg-transparent px-3.5 py-2.5 text-sm leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                    />
                    <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          title="Attach file (coming soon)"
                          className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Suggest prompt"
                          onClick={() => {
                            const p = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
                            setInput(p);
                          }}
                          className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                        >
                          <SparkleIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void send()}
                        disabled={loading || !input.trim() || !configured || noneConfigured || !activeChatId}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand-600/25 transition-all hover:from-brand-400 hover:to-cyan-500 disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Embedded (dashboard card) — simplified legacy layout */
  return (
    <Card className="flex flex-col min-h-[24rem] max-h-[36rem] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <h2 className="text-base font-semibold">AI Assistant</h2>
        {(providers?.ollamaModels?.length ?? 0) > 0 ? (
          <Select inputSize="sm" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}>
            {providers!.ollamaModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-xs text-slate-500">Ollama</span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">Use the floating chat button for the full experience.</p>
    </Card>
  );
}
