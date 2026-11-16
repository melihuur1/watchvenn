import { useId } from 'react';

// Two overlapping circles: everyone's taste, and the overlap you're looking for.
// r = 14 at x = 25 and 39, so the lens runs from y = 32 ± √(14² − 7²) ≈ 32 ± 12.12.
const LENS = 'M32 19.876a14 14 0 0 1 0 24.249a14 14 0 0 1 0-24.249z';

export function LogoMark({ className = 'size-8', animated = false }: { className?: string; animated?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <circle cx="25" cy="32" r="14" fill={`url(#${id}a)`} opacity="0.9" className={animated ? 'animate-venn-left' : undefined} />
      <circle cx="39" cy="32" r="14" fill={`url(#${id}b)`} opacity="0.9" className={animated ? 'animate-venn-right' : undefined} />
      {!animated && <path d={LENS} fill="#fff7ed" />}
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="size-8" />
      <span className="text-lg font-extrabold tracking-tight">
        Watch<span className="text-gradient">Venn</span>
      </span>
    </span>
  );
}
