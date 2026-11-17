import { useState } from 'react';
import type { RunAction } from '../hooks/useRoomActions';
import { navigate } from '../lib/router';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';

/** The way forward: the host can run another round with the same list; anyone can start fresh. */
export function ResultsActions({
  isHost,
  ready,
  run,
  newRoundLabel = 'Yeni tur',
}: {
  isHost: boolean;
  ready: boolean;
  run: RunAction;
  newRoundLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function newRound() {
    setPending(true);
    const ok = await run('round:new');
    setPending(false);
    if (ok) setConfirming(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/80 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 max-w-3xl items-center gap-3 px-4 py-3">
        {isHost ? (
          <>
            <Button variant="secondary" size="lg" onClick={() => navigate('/')} className="px-4">
              Yeni oda
            </Button>
            <Button size="lg" icon="refresh" disabled={!ready} onClick={() => setConfirming(true)} className="flex-1">
              {newRoundLabel}
            </Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-stone-400">Ev sahibi aynı filmlerle yeni bir tur başlatabilir.</p>
            <Button variant="secondary" size="lg" onClick={() => navigate('/')}>
              Yeni oda
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Yeni tur başlatılsın mı?"
        confirmLabel="Lobiye dön"
        pending={pending}
        onConfirm={newRound}
        onClose={() => setConfirming(false)}
      >
        <p>Bu sonuçlar herkes için kapanır ve oda lobiye döner. Film listesi korunur; filmleri değiştirip yeniden oylayabilirsiniz.</p>
        <p>Bu turu izleyenler de yeni turda oy verebilir.</p>
      </ConfirmDialog>
    </div>
  );
}
