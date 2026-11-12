export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sonora-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9bfff" />
          <stop offset="100%" stopColor="#f2a97f" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="#141626" />
      <path
        d="M6 17.5c2.2 0 2.2-6 4.4-6s2.2 9 4.4 9 2.2-12 4.4-12 2.2 9 4.4 9 1.6-3 2.4-3"
        fill="none"
        stroke="url(#sonora-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
