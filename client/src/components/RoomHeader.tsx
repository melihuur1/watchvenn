import { useState } from 'react';
import type { Phase, PublicRoom } from '@shared/types';
import { copyText, inviteUrl } from '../lib/clipboard';
import { errorMessage } from '../lib/errors';
import type { RoomConnection } from '../lib/roomConnection';
import { followLink, navigate } from '../lib/router';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Icon } from './ui/Icon';
import { LogoMark } from './ui/Logo';
import { useToast } from './ui/Toaster';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'lobby', label: 'Filmler' },
  { phase: 'voting', label: 'Oylama' },
  { phase: 'results', label: 'Sonuç' },
];

export function RoomHeader({ room, meId, ready, connection }: { room: PublicRoom; meId: string; ready: boolean; connection: RoomConnection }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const me = room.participants.find((p) => p.id === meId);
  const isHost = room.hostId === meId;

  async function copyLink() {
    const copied = await copyText(inviteUrl(room.code));
    toast(copied ? 'Davet linki kopyalandı.' : 'Kopyalanamadı. Linki adres çubuğundan paylaşabilirsin.', copied ? 'success' : 'error');
  }

  async function leave() {
    setLeaving(true);
    const result = await connection.leave();
    setLeaving(false);
    if (result.ok) navigate('/');
    else toast(errorMessage(result.error), 'error');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
      <a href="/" onClick={followLink} className="flex shrink-0 items-center gap-2 rounded-xl" aria-label="WatchVenn ana sayfa">
        <LogoMark className="size-8" />
        <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
          Watch<span className="text-gradient">Venn</span>
        </span>
      </a>

      <PhaseSteps phase={room.phase} />

      <button
        type="button"
        onClick={copyLink}
        className="hidden h-9 items-center gap-2 rounded-xl bg-white/[0.05] px-3 font-mono text-sm font-bold tracking-[0.18em] text-stone-200 ring-1 ring-white/10 transition hover:bg-white/10 sm:inline-flex"
        aria-label={`Oda kodu ${room.code}. Davet linkini kopyala`}
      >
        {room.code}
        <Icon name="copy" className="size-4 text-stone-400" />
      </button>
      <Button variant="ghost" size="sm" icon="logout" onClick={() => setConfirming(true)} disabled={!ready} aria-label="Odadan çık" className="px-2.5">
        <span className="hidden md:inline">Çık</span>
      </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Odadan çıkılsın mı?"
        confirmLabel="Odadan çık"
        tone="danger"
        pending={leaving}
        onConfirm={leave}
        onClose={() => setConfirming(false)}
      >
        <p>Odadakiler listesinden çıkarılırsın. Linkle istediğin zaman yeniden katılabilirsin.</p>
        {room.phase === 'voting' && me?.isVoter && !me.hasVoted && (
          <p>Oylama sürüyor: çıkarsan oyun sayılmaz, oylama da seni beklemez.</p>
        )}
        {isHost && room.participants.length > 1 && <p>Ev sahipliği odadaki bir sonraki kişiye geçer.</p>}
      </ConfirmDialog>
    </header>
  );
}

/** Where the room is in the journey. Only the current step's label shows on small screens. */
function PhaseSteps({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="mx-auto flex items-center gap-1.5 sm:gap-2" aria-label="Adımlar">
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={step.phase} className="flex items-center gap-1.5 sm:gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`h-px w-3 sm:w-6 ${i <= current ? 'bg-amber-300/60' : 'bg-white/15'}`} />}
            <span
              className={`grid size-6 place-items-center rounded-full text-[11px] font-black ${
                state === 'current'
                  ? 'bg-linear-to-br from-amber-300 to-rose-500 text-ink-950'
                  : state === 'done'
                    ? 'bg-amber-300/15 text-amber-200'
                    : 'bg-white/[0.06] text-stone-500'
              }`}
            >
              {state === 'done' ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-xs font-bold ${state === 'current' ? 'text-stone-100' : 'hidden text-stone-500 sm:inline'}`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
