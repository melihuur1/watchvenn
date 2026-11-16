import { useEffect, useId, useState } from 'react';

const SIZES = {
  lg: { box: 'size-28', text: 'text-[1.7rem]', stroke: 9 },
  sm: { box: 'size-16', text: 'text-base', stroke: 8 },
} as const;
const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;
const DURATION_MS = 1100;

/** Counts up to the compatibility percentage while the ring draws itself. */
export function CompatibilityRing({ value, size = 'lg', delayMs = 0 }: { value: number; size?: keyof typeof SIZES; delayMs?: number }) {
  const id = useId();
  const [shown, setShown] = useState(0);
  const s = SIZES[size];

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now + delayMs;
      const t = Math.min(Math.max((now - start) / DURATION_MS, 0), 1);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, delayMs]);

  return (
    <div className={`relative shrink-0 ${s.box}`} role="img" aria-label={`%${value} uyum`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255 / 0.09)" strokeWidth={s.stroke} />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - shown / 100)}
        />
      </svg>
      <span aria-hidden="true" className={`absolute inset-0 grid place-items-center font-black tabular-nums ${s.text}`}>
        <span>
          <span className="text-[0.6em] font-bold text-stone-400">%</span>
          {shown}
        </span>
      </span>
    </div>
  );
}
