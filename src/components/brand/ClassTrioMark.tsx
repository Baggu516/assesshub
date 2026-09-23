export function ClassTrioMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0d9488" />
      <circle cx="11" cy="17.5" r="2.15" fill="white" />
      <circle cx="16" cy="11.5" r="2.15" fill="white" />
      <circle cx="21" cy="17.5" r="2.15" fill="white" />
    </svg>
  );
}
