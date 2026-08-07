import { useState } from 'react';
import clsx from 'clsx';
import { DashboardAiChat } from './DashboardAiChat';

function ChatBubbleIcon({ className }: { className?: string }) {
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

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    setOpen((o) => {
      if (!o) setHasOpened(true);
      return !o;
    });
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-col items-end p-4 md:p-6">
      {hasOpened && (
        <div
          role="dialog"
          aria-label="AI Assistant"
          aria-hidden={!open}
          className={clsx(
            'pointer-events-auto mb-4 flex flex-col overflow-hidden rounded-[1.75rem]',
            'border border-white/70 bg-white/95 shadow-2xl shadow-brand-900/10 backdrop-blur-xl',
            'ring-1 ring-brand-500/10 dark:border-slate-700/80 dark:bg-slate-950/95 dark:shadow-black/50 dark:ring-brand-400/10',
            expanded
              ? 'h-[60vh] w-[60vw] max-h-[calc(100dvh-5.5rem)] max-w-[calc(100vw-2rem)]'
              : 'h-[min(36rem,calc(100dvh-5.5rem))] w-[min(52rem,calc(100vw-2rem))]',
            open ? 'animate-panel-up' : 'hidden'
          )}
        >
          <DashboardAiChat
            variant="widget"
            onClose={() => setOpen(false)}
            expanded={expanded}
            onToggleExpand={() => setExpanded((e) => !e)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        className={clsx(
          'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full text-white',
          'transition-all duration-200 hover:scale-105 active:scale-95',
          open
            ? 'bg-slate-800 shadow-lg shadow-slate-900/25 hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white'
            : 'bg-gradient-to-br from-brand-500 to-cyan-600 shadow-glow animate-soft-pulse hover:from-brand-400 hover:to-cyan-500'
        )}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={open}
      >
        {!open && (
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 to-transparent opacity-60"
            aria-hidden
          />
        )}
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <ChatBubbleIcon className="relative h-7 w-7" />
        )}
      </button>
    </div>
  );
}
