import { useState } from 'react';
import { LIMITS } from '@shared/constants';
import type { PublicRoom } from '@shared/types';
import type { RoomViewProps } from '../hooks/useRoomActions';
import { CatalogPicker } from './CatalogPicker';
import { InviteCard } from './InviteCard';
import { MovieCard } from './MovieCard';
import { ParticipantList } from './ParticipantList';
import { Button } from './ui/Button';
import { LogoMark } from './ui/Logo';
import { Panel } from './ui/Panel';

export function LobbyView({ room, meId, isHost, ready, run }: RoomViewProps) {
  const hostName = room.participants.find((p) => p.id === room.hostId)?.name ?? 'Ev sahibi';
  const nextRound = room.round > 1;

  return (
    <>
      <div className="mb-6 animate-fade-up">
        {nextRound && (
          <p className="mb-2 inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-amber-200 ring-1 ring-white/10">
            {room.round}. tur
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
          {isHost ? (nextRound ? 'Yeni tur: listeyi gözden geçir' : 'Filmleri seç') : `${hostName} filmleri seçiyor`}
        </h1>
        <p className="mt-2 max-w-2xl text-stone-400">
          {isHost
            ? nextRound
              ? 'Önceki turun filmleri listede duruyor. İstediğini çıkar, yenilerini ekle, sonra oylamayı başlat.'
              : `Arkadaşlarını davet et ve oylanacak ${LIMITS.minCandidates}–${LIMITS.maxCandidates} film seç. Odadaki herkes listeyi canlı görür.`
            : 'Liste burada canlı güncellenir. Ev sahibi oylamayı başlatınca kartlar otomatik açılacak.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-5 lg:sticky lg:top-20">
          <InviteCard code={room.code} alone={room.participants.length === 1} />
          <Panel title={`Odadakiler · ${room.participants.length}`}>
            <ParticipantList room={room} meId={meId} />
          </Panel>
        </aside>
        <div className="min-w-0 space-y-5">
          {isHost ? <CatalogPicker room={room} ready={ready} run={run} /> : <GuestCandidates room={room} />}
        </div>
      </div>

      <StartBar room={room} isHost={isHost} ready={ready} run={run} />
    </>
  );
}

/** What guests see: the host's list filling up, live. */
function GuestCandidates({ room }: { room: PublicRoom }) {
  const count = room.candidates.length;
  return (
    <Panel title={`Seçilen filmler · ${count}`}>
      {count === 0 ? (
        <div className="grid place-items-center px-4 py-12 text-center">
          <LogoMark className="size-14" animated />
          <p className="mt-4 font-semibold text-stone-200">Ev sahibi film seçiyor</p>
          <p className="mt-1 text-sm text-stone-500">Seçilen filmler burada tek tek belirecek.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-live="polite">
          {room.candidates.map((movie) => (
            <li key={movie.id} className="animate-card-in">
              <MovieCard movie={movie} size="tile" className="aspect-[3/4]" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Pinned to the bottom: the one next step, and what's missing before it can happen. */
function StartBar({ room, isHost, ready, run }: Pick<RoomViewProps, 'room' | 'isHost' | 'ready' | 'run'>) {
  const [pending, setPending] = useState(false);
  const count = room.candidates.length;
  const voters = room.participants.filter((p) => p.connected).length;
  const offline = room.participants.length - voters;
  const missing = Math.max(0, LIMITS.minCandidates - count);

  async function start() {
    setPending(true);
    await run('voting:start');
    setPending(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/80 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        {isHost ? (
          <>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-stone-100">
                {count} film · {voters} kişi oy verecek
              </p>
              <p className="text-xs text-stone-500">
                {offline > 0 ? `Çevrimdışı ${offline} kişi bu turu izleyici olarak takip eder.` : 'Oylama başlayınca liste kilitlenir.'}
              </p>
            </div>
            <Button size="lg" iconRight={missing === 0 ? 'arrow-right' : undefined} disabled={missing > 0 || !ready} loading={pending} onClick={start}>
              {missing === 0 ? 'Oylamayı başlat' : missing === LIMITS.minCandidates ? `En az ${missing} film seç` : `${missing} film daha seç`}
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2.5 text-sm text-stone-400">
            <span className="size-2 shrink-0 animate-breathe rounded-full bg-amber-300" aria-hidden="true" />
            Ev sahibi oylamayı başlatınca kartlar burada açılacak.
          </p>
        )}
      </div>
    </div>
  );
}
