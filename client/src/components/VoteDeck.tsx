import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { VOTE_LABELS } from '@shared/scoring';
import type { Movie, PublicRoom, Vote } from '@shared/types';
import type { RoomViewProps } from '../hooks/useRoomActions';
import { errorMessage } from '../lib/errors';
import { clearDraft, loadDraft, saveDraft, type Draft } from '../lib/session';
import { BallotReview } from './BallotReview';
import { HostVotingControls } from './HostVotingControls';
import { MovieCard, MovieCardBack } from './MovieCard';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { useToast } from './ui/Toaster';
import { VOTE_ORDER, VOTE_STYLES } from './votes';

const KEY_VOTES: Record<string, Vote> = {
  ArrowLeft: 'veto',
  '1': 'veto',
  ArrowDown: 'neutral',
  '2': 'neutral',
  ArrowRight: 'yes',
  '3': 'yes',
};
/** A little longer than the exit animation, so the card is gone before it's removed. */
const EXIT_MS = 320;

/** The draft saved for this room and round, limited to the current candidates. */
function restoreDraft(room: PublicRoom): Draft {
  const saved = loadDraft(room.code, room.round);
  if (!saved) return { votes: {}, position: 0 };
  const ids = new Set(room.candidates.map((m) => m.id));
  const votes = Object.fromEntries(Object.entries(saved.votes).filter(([id]) => ids.has(id)));
  return { votes, position: Math.min(Math.max(saved.position, 0), room.candidates.length) };
}

/**
 * One card at a time: Veto, Fark etmez or Evet, by tap or by ← ↓ →. Votes are a local draft
 * (saved per room and round, so a refresh loses nothing) until the whole ballot is submitted once.
 */
export function VoteDeck({ room, isHost, ready, run, connection }: RoomViewProps) {
  const toast = useToast();
  const movies = room.candidates;
  const total = movies.length;
  const [draft, setDraft] = useState<Draft>(() => restoreDraft(room));
  const [leaving, setLeaving] = useState<{ key: number; movie: Movie; vote: Vote } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const exitSeq = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const reviewing = draft.position >= total;
  const current = movies[draft.position];
  const next = movies[draft.position + 1];

  function update(nextDraft: Draft) {
    setDraft(nextDraft);
    saveDraft(room.code, room.round, nextDraft);
  }

  function cast(vote: Vote) {
    if (!current) return;
    const votes = { ...draft.votes, [current.id]: vote };
    const allVoted = movies.every((m) => votes[m.id]);
    update({ votes, position: allVoted ? total : draft.position + 1 });

    clearTimeout(exitTimer.current);
    exitSeq.current += 1;
    setLeaving({ key: exitSeq.current, movie: current, vote });
    exitTimer.current = setTimeout(() => setLeaving(null), EXIT_MS);
  }

  function back() {
    if (draft.position > 0) update({ ...draft, position: draft.position - 1 });
  }

  async function submit() {
    const ballot = Object.fromEntries(movies.map((m) => [m.id, draft.votes[m.id]!]));
    setSubmitting(true);
    const result = await connection.act('vote:submit', { round: room.round, ballot });
    if (result.ok || result.error === 'ALREADY_VOTED') {
      // The next snapshot marks us as voted and swaps this screen for the waiting panel.
      clearDraft(room.code);
      if (!result.ok) toast(errorMessage(result.error), 'info');
      return;
    }
    setSubmitting(false);
    toast(errorMessage(result.error), 'error');
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (reviewing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, dialog')) return;
    const vote = KEY_VOTES[event.key];
    if (vote) {
      event.preventDefault();
      cast(vote);
    } else if (event.key === 'Backspace' || event.key === 'ArrowUp') {
      event.preventDefault();
      back();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  // Keyboard and screen-reader users land on each new card.
  useEffect(() => {
    if (!reviewing) cardRef.current?.focus({ preventScroll: true });
  }, [draft.position, reviewing]);

  if (reviewing || !current) {
    return (
      <BallotReview
        movies={movies}
        votes={draft.votes}
        ready={ready}
        submitting={submitting}
        onChange={(id, vote) => update({ ...draft, votes: { ...draft.votes, [id]: vote } })}
        onBack={() => update({ ...draft, position: Math.max(total - 1, 0) })}
        onSubmit={submit}
        hostControls={isHost && <HostVotingControls room={room} ready={ready} run={run} compact />}
      />
    );
  }

  const chosen = draft.votes[current.id];

  return (
    <div className="mx-auto flex max-w-md flex-col">
      <div className="flex items-center gap-3">
        <p className="text-sm font-bold whitespace-nowrap tabular-nums">
          Film {draft.position + 1}
          <span className="text-stone-500"> / {total}</span>
        </p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-300 to-rose-500 transition-[width] duration-300"
            style={{ width: `${(draft.position / total) * 100}%` }}
          />
        </div>
        <Button variant="ghost" size="sm" icon="arrow-left" disabled={draft.position === 0} onClick={back} aria-keyshortcuts="Backspace">
          Önceki
        </Button>
      </div>

      <div className="relative mx-auto mt-4 aspect-[3/4] w-full max-w-[min(100%,calc(54dvh*0.75))]">
        {next && <MovieCardBack movie={next} className="absolute inset-0 translate-y-3 scale-[0.94] rounded-[2rem] opacity-50" />}
        <div
          ref={cardRef}
          key={current.id}
          tabIndex={-1}
          aria-roledescription="film kartı"
          aria-label={`${draft.position + 1}. film, toplam ${total}: ${current.title}`}
          className="absolute inset-0 animate-card-in rounded-[2rem] outline-none"
        >
          <MovieCard movie={current} size="deck" className="h-full" />
        </div>
        {leaving && (
          <div key={leaving.key} aria-hidden="true" className={`pointer-events-none absolute inset-0 z-10 ${VOTE_STYLES[leaving.vote].exit}`}>
            <MovieCard movie={leaving.movie} size="deck" className="h-full" />
            <span
              className={`absolute top-10 left-1/2 -translate-x-1/2 -rotate-12 rounded-2xl border-4 bg-black/35 px-5 py-1.5 text-3xl font-black tracking-wide whitespace-nowrap uppercase backdrop-blur-sm ${VOTE_STYLES[leaving.vote].stamp}`}
            >
              {VOTE_LABELS[leaving.vote]}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5" role="group" aria-label={`${current.title} için oyun`}>
        {VOTE_ORDER.map((vote, i) => (
          <button
            key={vote}
            type="button"
            onClick={() => cast(vote)}
            aria-pressed={chosen === vote}
            aria-keyshortcuts={`${['ArrowLeft', 'ArrowDown', 'ArrowRight'][i]} ${i + 1}`}
            className={`relative flex h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl font-bold ring-1 transition ring-inset active:scale-95 ${
              chosen === vote ? VOTE_STYLES[vote].active : VOTE_STYLES[vote].idle
            }`}
          >
            <Icon name={VOTE_STYLES[vote].icon} className="size-7" strokeWidth={2.75} />
            <span className="text-sm">{VOTE_LABELS[vote]}</span>
            <kbd className="absolute top-1.5 right-2 hidden font-sans text-[11px] font-semibold opacity-50 sm:block">
              {VOTE_STYLES[vote].keyHint}
            </kbd>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-stone-500">
        {chosen ? (
          <span className="font-semibold text-stone-300">Şu anki oyun: {VOTE_LABELS[chosen]}. Değiştirmek için başka birini seç.</span>
        ) : (
          <>
            <span className="sm:hidden">Oyların gizli; sonuçlarda kimin ne dediği görünmez.</span>
            <span className="hidden sm:inline">Klavye: ← Veto · ↓ Fark etmez · → Evet · ⌫ Önceki</span>
          </>
        )}
      </p>

      {isHost && <HostVotingControls room={room} ready={ready} run={run} compact />}
    </div>
  );
}
