import { useState } from 'react';
import type { PublicRoom } from '@shared/types';
import type { RunAction } from '../hooks/useRoomActions';
import { voterRoster } from '../lib/roster';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Icon } from './ui/Icon';

/**
 * End early (needs one ballot) or cancel (always). Each asks first and says exactly
 * what will happen, because neither can be undone.
 */
export function HostVotingControls({
  room,
  ready,
  run,
  compact = false,
}: {
  room: PublicRoom;
  ready: boolean;
  run: RunAction;
  compact?: boolean;
}) {
  const [dialog, setDialog] = useState<'end' | 'cancel' | null>(null);
  const [pending, setPending] = useState(false);
  const { voters, ballotCount } = voterRoster(room);
  const missing = voters.length - ballotCount;

  async function confirm(event: 'voting:end' | 'voting:cancel') {
    setPending(true);
    const ok = await run(event);
    setPending(false);
    if (ok) setDialog(null);
  }

  return (
    <section
      aria-label="Ev sahibi kontrolleri"
      className={`rounded-3xl bg-white/[0.035] ring-1 ring-white/[0.07] ${compact ? 'mt-6 p-4' : 'p-5'}`}
    >
      <div className="flex items-center gap-2 text-sm">
        <Icon name="crown" className="size-4 shrink-0 text-amber-300" />
        <p className="font-semibold text-stone-200">
          Ev sahibi kontrolleri <span className="font-normal text-stone-500">· {ballotCount}/{voters.length} oy geldi</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" size={compact ? 'sm' : 'md'} disabled={!ready || ballotCount === 0} onClick={() => setDialog('end')}>
          Oylamayı şimdi bitir
        </Button>
        <Button variant="danger" size={compact ? 'sm' : 'md'} disabled={!ready} onClick={() => setDialog('cancel')}>
          Oylamayı iptal et
        </Button>
      </div>
      {ballotCount === 0 && <p className="mt-2 text-xs text-stone-500">Erken bitirmek için en az bir oy gelmeli. İptal her zaman mümkün.</p>}

      <ConfirmDialog
        open={dialog === 'end'}
        title="Oylama şimdi bitirilsin mi?"
        confirmLabel="Şimdi bitir"
        pending={pending}
        onConfirm={() => confirm('voting:end')}
        onClose={() => setDialog(null)}
      >
        <p>
          Sonuçlar şu ana kadar gönderilen <strong className="text-stone-200">{ballotCount} oyla</strong> hesaplanacak.
        </p>
        {missing > 0 && (
          <p>
            Henüz oy vermeyen {missing} kişi bu turda hesaba katılmayacak. Yüzdeler yalnızca oy verenlere göre hesaplanır.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Oylama iptal edilsin mi?"
        confirmLabel="Evet, iptal et"
        cancelLabel="Oylamaya devam et"
        tone="danger"
        pending={pending}
        onConfirm={() => confirm('voting:cancel')}
        onClose={() => setDialog(null)}
      >
        <p>Gönderilen tüm oylar silinir ve herkes lobiye döner. Sonuç hesaplanmaz.</p>
        <p>Film listesi korunur; istersen değiştirip oylamayı yeniden başlatabilirsin.</p>
      </ConfirmDialog>
    </section>
  );
}
