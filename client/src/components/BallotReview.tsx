import type { ReactNode } from 'react';
import { VOTE_LABELS } from '@shared/scoring';
import type { Movie, Vote } from '@shared/types';
import { movieMeta } from '../lib/format';
import { MovieThumb } from './MovieCard';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { VOTE_ORDER, VOTE_STYLES, VoteCounts } from './votes';

/** Every vote at a glance, each one still changeable, then one submission. */
export function BallotReview({
  movies,
  votes,
  ready,
  submitting,
  onChange,
  onBack,
  onSubmit,
  hostControls,
}: {
  movies: Movie[];
  votes: Record<string, Vote>;
  ready: boolean;
  submitting: boolean;
  onChange: (movieId: string, vote: Vote) => void;
  onBack: () => void;
  onSubmit: () => void;
  hostControls?: ReactNode;
}) {
  const count = (vote: Vote) => movies.filter((m) => votes[m.id] === vote).length;
  const complete = movies.every((m) => votes[m.id]);
  const allVetoed = count('veto') === movies.length;
  const note = !ready ? 'Bağlantı bekleniyor. Oyların bu cihazda saklı, kaybolmaz.' : !complete ? 'Göndermek için her filme bir oy ver.' : null;

  return (
    // Only the content animates: a transformed ancestor would trap the fixed bar below.
    <div className="mx-auto max-w-2xl">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-black tracking-tight">Oylarını gözden geçir</h1>
        <p className="mt-2 text-stone-400">Göndermeden önce istediğin oyu değiştirebilirsin. Gönderdikten sonra oyların kesinleşir.</p>
        <VoteCounts yes={count('yes')} neutral={count('neutral')} veto={count('veto')} className="mt-4" />

        {allVetoed && (
          <p className="mt-4 flex gap-2.5 rounded-2xl bg-rose-500/10 p-3.5 text-sm text-rose-100 ring-1 ring-rose-400/20">
            <Icon name="info" className="mt-px size-[18px] shrink-0" />
            Her filmi veto ettin. Veto filmi doğrudan elediği için bu turda ortak bir film çıkmayacak.
          </p>
        )}

        <ul className="mt-5 divide-y divide-white/[0.06] overflow-hidden rounded-3xl bg-white/[0.035] ring-1 ring-white/[0.07]">
          {movies.map((movie) => (
            <li key={movie.id} className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
              <MovieThumb movie={movie} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{movie.title}</p>
                <p className="truncate text-xs text-stone-500">{movieMeta(movie) || 'Özel ekleme'}</p>
              </div>
              <div role="radiogroup" aria-label={`${movie.title} için oyun`} className="flex shrink-0 gap-1 rounded-2xl bg-black/25 p-1 ring-1 ring-white/10">
                {VOTE_ORDER.map((vote) => {
                  const checked = votes[movie.id] === vote;
                  return (
                    <button
                      key={vote}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={VOTE_LABELS[vote]}
                      title={VOTE_LABELS[vote]}
                      onClick={() => onChange(movie.id, vote)}
                      className={`grid size-10 place-items-center rounded-xl transition ${
                        checked ? VOTE_STYLES[vote].active : 'text-stone-500 hover:bg-white/10 hover:text-stone-200'
                      }`}
                    >
                      <Icon name={VOTE_STYLES[vote].icon} className="size-5" strokeWidth={checked ? 3 : 2.25} />
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        {hostControls}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {note && (
            <p className="mb-2 text-center text-xs font-medium text-amber-200/90" role="status">
              {note}
            </p>
          )}
          <div className="flex min-h-14 items-center justify-between gap-3">
            <Button variant="ghost" icon="arrow-left" onClick={onBack}>
              Kartlara dön
            </Button>
            <Button size="lg" icon="check" loading={submitting} disabled={!complete || !ready} onClick={onSubmit}>
              Oyları gönder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
