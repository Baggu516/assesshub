import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Toggle } from '@/components/ui/Toggle';

export type ChunkingStrategy = 'original' | 'semantic';

export type ChunkingConfig = {
  chunkingStrategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  syntheticQuestions: boolean;
  autoSummary: boolean;
  multiHopSearch: boolean;
};

type ChunkingSettingsProps = {
  value: ChunkingConfig;
  onChange: (next: ChunkingConfig) => void;
  enrichmentAvailable?: boolean;
};

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h4M16 8h4M10 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 16h4M16 16h4M14 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={clsx('h-5 w-5 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SettingCard({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex h-full flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/40',
        disabled && 'opacity-60'
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">State</span>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} aria-label={title} />
      </div>
    </div>
  );
}

function TokenInput({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 tabular-nums focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />
      <span className="mt-1 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</span>
    </label>
  );
}

function StrategyOption({
  selected,
  onSelect,
  title,
  description,
  name,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  name: string;
  value: ChunkingStrategy;
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
        selected
          ? 'border-violet-400 bg-violet-50/70 ring-1 ring-violet-400/40 dark:border-violet-500/60 dark:bg-violet-950/30'
          : 'border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900/40 dark:hover:border-slate-600'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-violet-600 focus:ring-violet-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
    </label>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{children}</h3>
  );
}

export function ChunkingSettings({ value, onChange, enrichmentAvailable = true }: ChunkingSettingsProps) {
  const [open, setOpen] = useState(true);
  const isOriginal = value.chunkingStrategy === 'original';
  const enrichDisabled = isOriginal || !enrichmentAvailable;
  const sizeInvalid = !(value.chunkSize > value.chunkOverlap) || value.chunkSize < 100;

  const patch = (partial: Partial<ChunkingConfig>) => onChange({ ...value, ...partial });

  const setStrategy = (chunkingStrategy: ChunkingStrategy) => {
    if (chunkingStrategy === 'original') {
      onChange({
        ...value,
        chunkingStrategy,
        autoSummary: false,
        syntheticQuestions: false,
      });
      return;
    }
    onChange({ ...value, chunkingStrategy });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 shadow-sm dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-950/20"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
          <SlidersIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
            Chunking settings
          </span>
          <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Strategy, ingestion enhancements, and retrieval — embeddings work with both strategies
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-slate-200/80 px-5 pb-5 pt-4 dark:border-slate-700/80">
          {/* Chunking Strategy */}
          <div>
            <SectionLabel>Chunking Strategy</SectionLabel>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Choose how documents are split. Semantic search (embeddings) is generated for both options.
            </p>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Chunking strategy">
              <StrategyOption
                name="chunkingStrategy"
                value="original"
                selected={isOriginal}
                onSelect={() => setStrategy('original')}
                title="Original Chunking (Source-only)"
                description="Preserve the original document structure. Text is split using the original paragraphs or fixed-size chunks without AI semantic grouping."
              />
              <StrategyOption
                name="chunkingStrategy"
                value="semantic"
                selected={value.chunkingStrategy === 'semantic'}
                onSelect={() => setStrategy('semantic')}
                title="Semantic Chunking"
                description="Use AI to group related sentences into meaningful chunks while respecting the configured maximum chunk size."
              />
            </div>
          </div>

          {/* Size / overlap — always available */}
          <div>
            <SectionLabel>Chunk size &amp; overlap</SectionLabel>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
              <div className="flex gap-4">
                <TokenInput
                  label="Chunk size"
                  hint="Maximum tokens allowed per chunk."
                  value={value.chunkSize}
                  onChange={(n) => patch({ chunkSize: n })}
                  min={100}
                  max={2000}
                />
                <TokenInput
                  label="Overlap"
                  hint="Tokens shared between consecutive chunks to preserve context."
                  value={value.chunkOverlap}
                  onChange={(n) => patch({ chunkOverlap: n })}
                  min={0}
                  max={400}
                />
              </div>
              {sizeInvalid && (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                  Chunk size must be at least 100 and greater than overlap.
                </p>
              )}
              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                {isOriginal
                  ? 'Used as the fixed chunk size when paragraphs exceed the budget.'
                  : 'Used as the maximum token budget for each semantic chunk; overlap applies when chunks are split further.'}
              </p>
            </div>
          </div>

          {/* AI Ingestion Enhancements */}
          <div>
            <SectionLabel>AI Ingestion Enhancements</SectionLabel>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {isOriginal
                ? 'Unavailable with Original Chunking (source-only). Switch to Semantic Chunking to enable.'
                : 'Extra indexed segments created during document ingestion when an LLM is available.'}
            </p>
            {!enrichmentAvailable && !isOriginal && (
              <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                Start Ollama and restart the backend so auto summary and synthetic questions can run locally.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingCard
                title="Auto summary"
                description="Create a high-level summary chunk for each document."
                checked={isOriginal ? false : value.autoSummary}
                onChange={(v) => patch({ autoSummary: v })}
                disabled={enrichDisabled}
              />
              <SettingCard
                title="Synthetic questions"
                description="Generate AI question variants during ingestion to improve search accuracy."
                checked={isOriginal ? false : value.syntheticQuestions}
                onChange={(v) => patch({ syntheticQuestions: v })}
                disabled={enrichDisabled}
              />
            </div>
          </div>

          {/* Retrieval Features */}
          <div>
            <SectionLabel>Retrieval Features</SectionLabel>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Applied at query time. Independent of how documents were chunked.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingCard
                title="Multi-hop search"
                description="Run a second search pass when initial results have low confidence."
                checked={value.multiHopSearch}
                onChange={(v) => patch({ multiHopSearch: v })}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
