import { describe, expect, it } from 'vitest';
import type { PublicParticipant, PublicRoom, Results } from '@shared/types';
import { diffRoom } from './roomEvents';

const person = (id: string, patch: Partial<PublicParticipant> = {}): PublicParticipant => ({
  id,
  name: id.toUpperCase(),
  connected: true,
  isVoter: false,
  hasVoted: false,
  ...patch,
});

const room = (patch: Partial<PublicRoom> = {}): PublicRoom => ({
  code: 'K7M2QX',
  phase: 'lobby',
  round: 1,
  hostId: 'host',
  participants: [person('host'), person('me')],
  departedVoters: [],
  candidates: [],
  results: null,
  ...patch,
});

const results = (excludedCount: number) => ({ excludedCount }) as Results;

describe('diffRoom', () => {
  it('reports who joined, left, dropped and came back, but not myself', () => {
    const prev = room({ participants: [person('host'), person('me'), person('ali'), person('can', { connected: false })] });
    const next = room({ participants: [person('host', { connected: false }), person('me'), person('can'), person('zey')] });

    expect(diffRoom(prev, next, 'me')).toEqual([
      { kind: 'offline', name: 'HOST' },
      { kind: 'online', name: 'CAN' },
      { kind: 'joined', name: 'ZEY' },
      { kind: 'left', name: 'ALI' },
    ]);
  });

  it('reports votes and a host hand-over', () => {
    const voting = { phase: 'voting' as const };
    const prev = room({ ...voting, participants: [person('host', { isVoter: true }), person('me', { isVoter: true })] });
    const next = room({
      ...voting,
      hostId: 'me',
      participants: [person('host', { isVoter: true, hasVoted: true }), person('me', { isVoter: true, hasVoted: true })],
    });

    expect(diffRoom(prev, next, 'me')).toEqual([
      { kind: 'voted', name: 'HOST', isMe: false },
      { kind: 'voted', name: 'ME', isMe: true },
      { kind: 'host-changed', name: 'ME', isMe: true },
    ]);
  });

  it('tells a spectator that voting started without them', () => {
    const next = room({ phase: 'voting', participants: [person('host', { isVoter: true }), person('me')] });
    expect(diffRoom(room(), next, 'me')).toEqual([{ kind: 'voting-started', spectating: true }]);
  });

  it('distinguishes a cancel, an early end that skipped me, and a new round', () => {
    const voting = room({ phase: 'voting', participants: [person('host', { isVoter: true }), person('me', { isVoter: true })] });

    expect(diffRoom(voting, room({ round: 2 }), 'me')).toEqual([{ kind: 'voting-cancelled', byMe: false }]);
    expect(diffRoom(voting, room({ round: 2 }), 'host')).toEqual([{ kind: 'voting-cancelled', byMe: true }]);

    const ended = room({ ...voting, phase: 'results', results: results(1) });
    expect(diffRoom(voting, ended, 'me')).toEqual([{ kind: 'results', early: true, missedMyVote: true }]);

    expect(diffRoom(ended, room({ round: 2 }), 'me')).toEqual([{ kind: 'new-round', byMe: false }]);
  });
});
