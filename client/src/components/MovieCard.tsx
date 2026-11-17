// Designed gradient cards instead of posters: no images, no external requests.
import type { CSSProperties, ReactNode } from 'react';
import { GENRE_LABELS } from '@shared/catalog';
import type { Movie } from '@shared/types';
import { movieMeta } from '../lib/format';

type Size = 'deck' | 'hero' | 'tile' | 'banner' | 'strip';

const SIZES: Record<Size, { root: string; title: string; genres: number }> = {
  deck: { root: 'rounded-[2rem] p-6 sm:p-8', title: 'text-[2.15rem] sm:text-5xl line-clamp-5', genres: 3 },
  hero: { root: 'rounded-[1.6rem] p-4', title: 'text-2xl line-clamp-3', genres: 1 },
  // Long custom titles (up to 60 characters) must not push the card's text out of its frame.
  tile: { root: 'rounded-2xl p-3', title: 'text-[17px] line-clamp-4', genres: 1 },
  /** Square-cornered, for the top of a results card. */
  banner: { root: 'p-5 sm:p-7', title: 'text-[2rem] sm:text-5xl line-clamp-4', genres: 2 },
  strip: { root: 'p-4', title: 'text-2xl line-clamp-3', genres: 1 },
};

export function gradient(movie: Movie, angle = 155): string {
  const [from, to] = movie.palette;
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
}

export function MovieCard({
  movie,
  size = 'tile',
  className = '',
  style,
  children,
}: {
  movie: Movie;
  size?: Size;
  className?: string;
  style?: CSSProperties;
  /** Overlays such as a selection check or a vote badge. */
  children?: ReactNode;
}) {
  const s = SIZES[size];
  const meta = movieMeta(movie);
  const showOriginal = movie.kind === 'catalog' && movie.originalTitle !== movie.title;

  return (
    <article
      className={`relative isolate flex flex-col justify-between overflow-hidden text-white shadow-[0_18px_50px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10 ${s.root} ${className}`}
      style={{ backgroundImage: gradient(movie), ...style }}
    >
      {/* Sheen, the brand's two circles as a watermark, and a shade so text always reads. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_12%_0%,rgb(255_255_255/0.22),transparent_55%)]" />
      <svg aria-hidden="true" viewBox="0 0 100 64" className="absolute -right-[22%] -bottom-[10%] -z-10 w-[85%] max-w-[26rem] opacity-[0.17]">
        <circle cx="34" cy="32" r="30" fill="none" stroke="white" strokeWidth="1.1" />
        <circle cx="66" cy="32" r="30" fill="none" stroke="white" strokeWidth="1.1" />
      </svg>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-linear-to-t from-black/65 via-black/25 to-transparent" />

      {/* Small tiles carry a corner button (add, remove, check): keep the chips clear of it. */}
      <div className={`flex flex-wrap gap-1.5 ${size === 'tile' ? 'pr-8' : ''}`}>
        {movie.kind === 'custom' ? (
          <Chip>Özel ekleme</Chip>
        ) : (
          movie.genres.slice(0, s.genres).map((genre) => <Chip key={genre}>{GENRE_LABELS[genre]}</Chip>)
        )}
      </div>

      <div className="mt-6">
        <h3 title={movie.title} className={`font-black leading-[0.98] tracking-tight text-balance [overflow-wrap:anywhere] ${s.title}`}>
          {movie.title}
        </h3>
        {showOriginal && (
          <p className={`mt-1.5 font-medium text-white/70 ${size === 'tile' ? 'truncate text-xs' : 'text-sm sm:text-base'}`}>
            {movie.originalTitle}
          </p>
        )}
        {meta && (
          <p className={`mt-2 font-semibold text-white/85 tabular-nums ${size === 'tile' ? 'text-xs' : 'text-sm'}`}>{meta}</p>
        )}
        {size === 'deck' && movie.kind === 'catalog' && (
          <p className="mt-4 max-w-prose text-[15px] leading-snug text-white/85 sm:text-base">{movie.description}</p>
        )}
        {size === 'banner' && movie.kind === 'catalog' && (
          <p className="mt-3 hidden max-w-xl text-[15px] leading-snug text-white/85 sm:block">{movie.description}</p>
        )}
      </div>
      {children}
    </article>
  );
}

/** The same card without text: for decorative stacks where only the top card is read. */
export function MovieCardBack({ movie, className = '', style }: { movie: Movie; className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden ring-1 ring-white/10 ${className}`}
      style={{ backgroundImage: gradient(movie), ...style }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_12%_0%,rgb(255_255_255/0.2),transparent_55%)]" />
      <svg viewBox="0 0 100 64" className="absolute top-1/2 left-1/2 w-[80%] -translate-x-1/2 -translate-y-1/2 opacity-20">
        <circle cx="34" cy="32" r="30" fill="none" stroke="white" strokeWidth="1.1" />
        <circle cx="66" cy="32" r="30" fill="none" stroke="white" strokeWidth="1.1" />
      </svg>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-full min-w-0 truncate rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/90 uppercase ring-1 ring-white/15 backdrop-blur-sm">
      {children}
    </span>
  );
}

/** A small square stand-in for a movie in lists and tables. */
export function MovieThumb({ movie, className = 'size-11' }: { movie: Movie; className?: string }) {
  const initial = Array.from(movie.title.trim())[0]?.toLocaleUpperCase('tr') ?? '?';
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-xl text-lg font-black text-white/90 ring-1 ring-white/10 ${className}`}
      style={{ backgroundImage: gradient(movie, 140) }}
    >
      {initial}
    </span>
  );
}
