import { useState } from 'react';
import clsx from 'clsx';
import { Toggle } from '@/components/ui/Toggle';

export type ChunkingConfig = {
  sourceOnlyMode: boolean;
  semanticSplitting: boolean;
  syntheticQuestions: boolean;
  autoSummary: boolean;
  multiHopSearch: boolean;
  targetTokens: number;
  overlapTokens: number;
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
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/40">
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
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <label className="block flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 tabular-nums focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />
    </label>
  );
}

export function ChunkingSettings({ value, onChange, enrichmentAvailable = true }: ChunkingSettingsProps) {
  const [open, setOpen] = useState(true);
  const enrichDisabled = value.sourceOnlyMode || !enrichmentAvailable;

  const patch = (partial: Partial<ChunkingConfig>) => onChange({ ...value, ...partial });

  const onSourceOnly = (checked: boolean) => {
    onChange({
      ...value,
      sourceOnlyMode: checked,
      ...(checked
        ? { syntheticQuestions: false, autoSummary: false, semanticSplitting: false }
        : { semanticSplitting: true }),
    });
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
            Configure how documents are split and processed
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="border-t border-slate-200/80 px-5 pb-5 pt-4 dark:border-slate-700/80">
          {!enrichmentAvailable && (
            <p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              Set GEMINI_API_KEY or GROQ_API_KEY on the server to enable auto summary and synthetic questions.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <SettingCard
              title="Source-only mode"
              description="Use original paragraphs as-is, skip generating summaries or synthetic questions."
              checked={value.sourceOnlyMode}
              onChange={onSourceOnly}
            />
            <SettingCard
              title="Semantic splitting"
              description="Group related sentences together instead of fixed-size splits."
              checked={value.semanticSplitting}
              onChange={(v) => patch({ semanticSplitting: v })}
              disabled={value.sourceOnlyMode}
            />
            <SettingCard
              title="Synthetic questions"
              description="Generate AI question variants during ingestion to improve search accuracy."
              checked={value.syntheticQuestions}
              onChange={(v) => patch({ syntheticQuestions: v })}
              disabled={enrichDisabled}
            />
            <SettingCard
              title="Auto summary"
              description="Create a high-level summary chunk for each document."
              checked={value.autoSummary}
              onChange={(v) => patch({ autoSummary: v })}
              disabled={enrichDisabled}
            />
            <SettingCard
              title="Multi-hop search"
              description="Run a second search pass when initial results have low confidence."
              checked={value.multiHopSearch}
              onChange={(v) => patch({ multiHopSearch: v })}
            />

            <div className="flex h-full flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Chunk size</h3>
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-700"
                  title="Target size per chunk and overlap between consecutive chunks (approximate tokens)."
                >
                  ?
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Token budgets used when splitting document text.
              </p>
              <div className="mt-4 flex gap-3">
                <TokenInput
                  label="Target tokens"
                  value={value.targetTokens}
                  onChange={(n) => patch({ targetTokens: n })}
                  min={100}
                  max={2000}
                  disabled={value.sourceOnlyMode}
                />
                <TokenInput
                  label="Overlap tokens"
                  value={value.overlapTokens}
                  onChange={(n) => patch({ overlapTokens: n })}
                  min={0}
                  max={400}
                  disabled={value.sourceOnlyMode}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
