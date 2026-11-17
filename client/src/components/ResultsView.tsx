import { useEffect, useState, type CSSProperties } from 'react';
import { ALGORITHM_SUMMARY, compatibilityLabel, reasonText, turnoutText } from '@shared/scoring';
import type { MovieResult, Results } from '@shared/types';
import type { RoomViewProps } from '../hooks/useRoomActions';
import { CompatibilityRing } from './CompatibilityRing';
import { MovieCard } from './MovieCard';
import { NoMatchView } from './NoMatchView';
import { ResultsActions } from './ResultsActions';
import { ResultsBreakdown } from './ResultsBreakdown';
import { Icon } from './ui/Icon';
import { LogoMark } from './ui/Logo';
import { VoteCounts } from './votes';

const CALCULATING_MS = 1400;

/**
 * `reveal`: the room just moved here from voting, so play the short "calculating" moment
 * before the podium. Arriving by refresh or link goes straight to the results.
 */
export function ResultsView({ room, isHost, ready, run, reveal }: RoomViewProps & { reveal: boolean }) {
  const [calculating, setCalculating] = useState(
    () => reveal && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (!calculating) return;
    const timer = setTimeout(() => setCalculating(false), CALCULATING_MS);
    return () => clearTimeout(timer);
  }, [calculating]);

  const results = room.results;
  if (!results) return null;

  if (calculating) {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center" role="status">
        <div className="animate-fade-in">
          <LogoMark className="mx-auto size-24" animated />
          <p className="mt-5 text-2xl font-black tracking-tight">Oylar hesaplanıyor…</p>
          <p className="mt-1 text-stone-400">Kimsenin veto etmediği filmler aranıyor</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {results.status === 'no-match' ? <NoMatchView results={results} /> : <Podium results={results} />}
      <ResultsActions
        isHost={isHost}
        ready={ready}
        run={run}
        newRoundLabel={results.status === 'no-match' ? 'Yeni tur: farklı filmler dene' : 'Yeni tur'}
      />
    </>
  );
}

function Podium({ results }: { results: Results }) {
  const [winner, ...others] = results.top;
  const early = results.excludedCount > 0;
  if (!winner) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="animate-fade-up">
        <p className="text-sm font-bold tracking-wider text-amber-200 uppercase">Sonuçlar hazır</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-balance sm:text-4xl">İşte ortak paydanız</h1>
        <p className="mt-2 flex items-center gap-2 text-stone-400">
          <Icon name="users" className="size-4 shrink-0" />
          {turnoutText(results)}
        </p>
        {early && (
          <p className="mt-3 flex gap-2.5 rounded-2xl bg-amber-300/10 p-3.5 text-sm text-amber-100 ring-1 ring-amber-300/20">
            <Icon name="info" className="mt-px size-[18px] shrink-0" />
            Oylama erken bitirildi. Yüzdeler ve sıralama yalnızca oy veren {results.ballotCount} kişinin oylarına göre.
          </p>
        )}
      </header>

      <WinnerCard result={winner} results={results} />

      {others.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {others.map((result, i) => (
            <RunnerUpCard key={result.movie.id} result={result} results={results} delayMs={450 + i * 250} />
          ))}
        </div>
      )}

      {results.top.length < 3 && results.breakdown.some((r) => r.eliminated) && (
        <p className="flex gap-2.5 px-1 text-sm text-stone-400">
          <Icon name="info" className="mt-px size-4 shrink-0" />
          Sadece {results.top.length} film hiç veto almadı; diğerleri en az bir vetoyla elendi.
        </p>
      )}

      <section className="rounded-3xl bg-white/[0.035] p-5 ring-1 ring-white/[0.07]">
        <h2 className="flex items-center gap-2 font-semibold">
          <LogoMark className="size-5" />
          Nasıl hesaplandı?
        </h2>
        <p className="mt-2 text-[15px] text-stone-300">{ALGORITHM_SUMMARY}</p>
        <p className="mt-1 text-sm text-stone-500">
          Tek bir veto filmi eler. Kalanlarda Evet 2, Fark etmez 1 puan; uyum, alınabilecek en yüksek puana oranıdır.
          {early && ' Bu turda yalnızca oy verenler hesaba katıldı.'}
        </p>
      </section>

      <ResultsBreakdown results={results} />
    </div>
  );
}

function RankBadge({ result }: { result: MovieResult }) {
  return (
    <span className="absolute top-4 right-4 flex items-center gap-1.5">
      {result.tied && (
        <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur">Berabere</span>
      )}
      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-ink-950 tabular-nums">#{result.rank}</span>
    </span>
  );
}

function WinnerCard({ result, results }: { result: MovieResult; results: Results }) {
  return (
    <article className="animate-card-in overflow-hidden rounded-[2rem] bg-white/[0.04] shadow-[0_30px_80px_-30px_rgb(244_63_94/0.45)] ring-1 ring-white/[0.1]">
      <MovieCard movie={result.movie} size="banner" className="aspect-[16/11] sm:aspect-[16/7] lg:aspect-[16/6]">
        <RankBadge result={result} />
      </MovieCard>
      <div className="flex items-center gap-5 p-5 sm:p-6">
        <CompatibilityRing value={result.compatibility} delayMs={250} />
        <div className="min-w-0">
          <p className="text-xl font-black tracking-tight">{compatibilityLabel(result, results)}</p>
          <p className="mt-1 text-[15px] leading-snug text-stone-300">{reasonText(result, results)}</p>
          <VoteCounts yes={result.yes} neutral={result.neutral} veto={result.veto} className="mt-2.5" />
        </div>
      </div>
    </article>
  );
}

function RunnerUpCard({ result, results, delayMs }: { result: MovieResult; results: Results; delayMs: number }) {
  return (
    <article
      className="animate-fade-up overflow-hidden rounded-3xl bg-white/[0.035] ring-1 ring-white/[0.08]"
      style={{ animationDelay: `${delayMs}ms` } as CSSProperties}
    >
      <MovieCard movie={result.movie} size="strip" className="aspect-[16/8]">
        <RankBadge result={result} />
      </MovieCard>
      <div className="flex items-center gap-4 p-4">
        <CompatibilityRing value={result.compatibility} size="sm" delayMs={delayMs} />
        <div className="min-w-0">
          <p className="font-bold">{compatibilityLabel(result, results)}</p>
          <p className="mt-0.5 text-sm leading-snug text-stone-400">{reasonText(result, results)}</p>
          <VoteCounts yes={result.yes} neutral={result.neutral} veto={result.veto} className="mt-2" />
        </div>
      </div>
    </article>
  );
}
