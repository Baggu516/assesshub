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
            'pointer-events-auto mb-4 flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40',
            expanded
              ? 'h-[60vh] w-[60vw] max-h-[calc(100dvh-5.5rem)] max-w-[calc(100vw-2rem)]'
              : 'h-[min(36rem,calc(100dvh-5.5rem))] w-[min(52rem,calc(100vw-2rem))]',
            !open && 'hidden'
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
          'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95',
          open
            ? 'bg-slate-700 text-white hover:bg-slate-800'
            : 'bg-violet-600 text-white hover:bg-violet-500'
        )}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <ChatBubbleIcon className="h-7 w-7" />
        )}
      </button>
    </div>
  );
}
