// What changed between two snapshots, as events. Snapshots carry the whole room, so
// "Ali joined" or "voting was cancelled" are derived here instead of being sent separately.
import type { PublicRoom } from '@shared/types';

export type RoomEvent =
  | { kind: 'joined'; name: string }
  | { kind: 'left'; name: string }
  | { kind: 'online'; name: string }
  | { kind: 'offline'; name: string }
  | { kind: 'voted'; name: string; isMe: boolean }
  | { kind: 'host-changed'; name: string; isMe: boolean }
  | { kind: 'voting-started'; spectating: boolean }
  /** Back to the lobby from voting: the host cancelled, or every voter left before anyone voted. */
  | { kind: 'voting-cancelled'; byMe: boolean }
  | { kind: 'results'; early: boolean; missedMyVote: boolean }
  | { kind: 'new-round'; byMe: boolean };

export function diffRoom(prev: PublicRoom, next: PublicRoom, meId: string): RoomEvent[] {
  const events: RoomEvent[] = [];
  const before = new Map(prev.participants.map((p) => [p.id, p]));
  const after = new Map(next.participants.map((p) => [p.id, p]));
  const amHost = next.hostId === meId;

  for (const p of next.participants) {
    const old = before.get(p.id);
    if (!old) {
      if (p.id !== meId) events.push({ kind: 'joined', name: p.name });
      continue;
    }
    if (p.id !== meId && old.connected !== p.connected) events.push({ kind: p.connected ? 'online' : 'offline', name: p.name });
    if (!old.hasVoted && p.hasVoted && next.phase === 'voting') events.push({ kind: 'voted', name: p.name, isMe: p.id === meId });
  }
  for (const p of prev.participants) {
    if (!after.has(p.id) && p.id !== meId) events.push({ kind: 'left', name: p.name });
  }

  if (prev.hostId !== next.hostId) {
    const host = after.get(next.hostId);
    if (host) events.push({ kind: 'host-changed', name: host.name, isMe: host.id === meId });
  }

  if (prev.phase !== next.phase) {
    const me = after.get(meId);
    if (prev.phase === 'lobby' && next.phase === 'voting') {
      events.push({ kind: 'voting-started', spectating: !me?.isVoter });
    } else if (prev.phase === 'voting' && next.phase === 'lobby') {
      events.push({ kind: 'voting-cancelled', byMe: amHost });
    } else if (prev.phase === 'voting' && next.phase === 'results') {
      events.push({
        kind: 'results',
        early: (next.results?.excludedCount ?? 0) > 0,
        missedMyVote: Boolean(me?.isVoter && !me.hasVoted),
      });
    } else if (prev.phase === 'results' && next.phase === 'lobby') {
      events.push({ kind: 'new-round', byMe: amHost });
    }
  }
  return events;
}

/** One short Turkish sentence per event, for the screen-reader live region. */
export function describeEvent(event: RoomEvent): string {
  switch (event.kind) {
    case 'joined':
      return `${event.name} odaya katıldı`;
    case 'left':
      return `${event.name} odadan ayrıldı`;
    case 'online':
      return `${event.name} yeniden çevrimiçi`;
    case 'offline':
      return `${event.name} çevrimdışı`;
    case 'voted':
      return event.isMe ? 'Oyun alındı' : `${event.name} oyunu verdi`;
    case 'host-changed':
      return event.isMe ? 'Artık ev sahibi sensin' : `Yeni ev sahibi: ${event.name}`;
    case 'voting-started':
      return event.spectating ? 'Oylama başladı. Bu turu izliyorsun' : 'Oylama başladı';
    case 'voting-cancelled':
      return 'Oylama iptal edildi. Lobiye dönüldü';
    case 'results':
      return 'Sonuçlar açıklandı';
    case 'new-round':
      return 'Yeni tur başladı';
  }
}
