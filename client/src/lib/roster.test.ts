import { describe, expect, it } from 'vitest';
import type { PublicRoom } from '@shared/types';
import { voterRoster } from './roster';

describe('voterRoster', () => {
  it('counts departed voters in the total but never waits for them', () => {
    const room: PublicRoom = {
      code: 'K7M2QX',
      phase: 'voting',
      round: 1,
      hostId: 'a',
      participants: [
        { id: 'a', name: 'Ayşe', connected: true, isVoter: true, hasVoted: true },
        { id: 'b', name: 'Ali', connected: false, isVoter: true, hasVoted: false },
        { id: 'c', name: 'Can', connected: true, isVoter: false, hasVoted: false },
      ],
      departedVoters: [
        { id: 'd', name: 'Deniz', hasVoted: true },
        { id: 'e', name: 'Ece', hasVoted: false },
      ],
      candidates: [],
      results: null,
    };

    const roster = voterRoster(room);

    expect(roster.voters.map((v) => [v.name, v.hasVoted, v.departed])).toEqual([
      ['Ayşe', true, false],
      ['Ali', false, false],
      ['Deniz', true, true],
      ['Ece', false, true],
    ]);
    expect(roster.spectators.map((s) => s.name)).toEqual(['Can']);
    expect(roster.ballotCount).toBe(2);
    expect(roster.pendingCount).toBe(1); // only Ali: offline, but still awaited
  });
});
