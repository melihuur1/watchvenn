import { useEffect, useEffectEvent, useRef } from 'react';
import type { PublicRoom } from '@shared/types';
import { clearDraft } from '../lib/session';
import { describeEvent, diffRoom, type RoomEvent } from '../lib/roomEvents';
import { useToast } from './ui/Toaster';

/**
 * Turns snapshot changes into feedback: every change is announced to screen readers, and
 * the ones that move people around (a cancel, an early end, a new host) also get a toast.
 */
export function RoomNotifier({ room, meId }: { room: PublicRoom; meId: string }) {
  const toast = useToast();
  const region = useRef<HTMLDivElement>(null);
  const previous = useRef(room);

  const handle = useEffectEvent((events: RoomEvent[]) => {
    if (region.current) region.current.textContent = events.map(describeEvent).join('. ');
    for (const event of events) {
      const message = toastFor(event);
      if (message) toast(message.text, message.tone);
      if (event.kind === 'voting-cancelled' || event.kind === 'results') clearDraft(room.code);
    }
  });

  useEffect(() => {
    const prev = previous.current;
    previous.current = room;
    if (prev === room) return;
    const events = diffRoom(prev, room, meId);
    if (events.length > 0) handle(events);
  }, [room, meId]);

  return <div ref={region} aria-live="polite" className="sr-only" />;
}

function toastFor(event: RoomEvent): { text: string; tone: 'info' | 'success' } | null {
  switch (event.kind) {
    case 'host-changed':
      return event.isMe
        ? { text: 'Artık ev sahibi sensin. Kontroller sende.', tone: 'success' }
        : { text: `Yeni ev sahibi: ${event.name}`, tone: 'info' };
    case 'voting-started':
      return event.spectating ? { text: 'Oylama başladı. Bu turu izliyorsun, sonraki turda oy verebilirsin.', tone: 'info' } : null;
    case 'voting-cancelled':
      return event.byMe ? null : { text: 'Oylama iptal edildi, lobiye döndünüz. Hiçbir oy sayılmadı.', tone: 'info' };
    case 'results':
      return event.missedMyVote
        ? { text: 'Oylama sen oyunu göndermeden bitirildi. Bu turda hesaba katılmadın.', tone: 'info' }
        : null;
    case 'new-round':
      return event.byMe ? null : { text: 'Yeni tur başladı. Film listesi korunuyor.', tone: 'info' };
    default:
      return null;
  }
}
