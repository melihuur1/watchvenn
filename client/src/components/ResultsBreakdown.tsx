import { reasonText } from '@shared/scoring';
import type { Results } from '@shared/types';
import { MovieThumb } from './MovieCard';
import { Icon } from './ui/Icon';
import { VoteCounts } from './votes';

/** Every candidate: eligible in rank order, then the eliminated ones, fewest vetoes first. */
export function ResultsBreakdown({ results, open = false }: { results: Results; open?: boolean }) {
  return (
    <details open={open} className="group rounded-3xl bg-white/[0.035] ring-1 ring-white/[0.07]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          Tüm sonuçlar <span className="font-normal text-stone-500">· {results.breakdown.length} film</span>
        </span>
        <Icon name="chevron-down" className="size-5 text-stone-400 transition group-open:rotate-180" />
      </summary>
      <ol className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {results.breakdown.map((result) => (
          <li key={result.movie.id} className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${result.eliminated ? 'opacity-70' : ''}`}>
            <span className="w-6 shrink-0 text-center text-sm font-black text-stone-400 tabular-nums">
              {result.rank === null ? '–' : result.rank}
            </span>
            <MovieThumb movie={result.movie} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className={`truncate font-semibold ${result.eliminated ? 'text-stone-400 line-through decoration-rose-400/60' : ''}`}>
                {result.movie.title}
              </p>
              <VoteCounts yes={result.yes} neutral={result.neutral} veto={result.veto} className="mt-1" />
            </div>
            <span className={`shrink-0 text-right text-sm font-bold tabular-nums ${result.eliminated ? 'text-rose-300' : 'text-stone-100'}`}>
              {result.eliminated ? reasonText(result, results) : `%${result.compatibility}`}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
