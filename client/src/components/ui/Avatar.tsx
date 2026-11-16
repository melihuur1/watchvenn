import { paletteForTitle } from '@shared/catalog';

const SIZES = {
  sm: 'size-8 text-sm',
  md: 'size-10 text-base',
  lg: 'size-14 text-xl',
} as const;

/** A person's initial on a gradient that is always the same for the same name. */
export function Avatar({
  name,
  size = 'md',
  online,
  className = '',
}: {
  name: string;
  size?: keyof typeof SIZES;
  /** Shows a presence dot when set. */
  online?: boolean;
  className?: string;
}) {
  const [from, to] = paletteForTitle(name);
  const initial = (Array.from(name.trim())[0] ?? '?').toLocaleUpperCase('tr');
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-full font-bold text-white ring-1 ring-white/15 ${SIZES[size]} ${online === false ? 'opacity-45 grayscale' : ''}`}
        style={{ backgroundImage: `linear-gradient(140deg, ${from}, ${to})` }}
      >
        {initial}
      </span>
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-ink-900 ${online ? 'bg-emerald-400' : 'bg-stone-500'}`}
        />
      )}
    </span>
  );
}
