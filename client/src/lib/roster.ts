import type { PublicRoom } from '@shared/types';

export interface RosterVoter {
  id: string;
  name: string;
  hasVoted: boolean;
  connected: boolean;
  /** Left the room after voting started. Still counts in the voter total. */
  departed: boolean;
}

export interface Roster {
  /** Everyone locked in at voting start, including those who left since. */
  voters: RosterVoter[];
  /** Joined late or were offline at the start: they watch this round. */
  spectators: { id: string; name: string }[];
  ballotCount: number;
  /** Present voters who haven't voted yet: the round is waiting for them. */
  pendingCount: number;
}

export function voterRoster(room: PublicRoom): Roster {
  const voters: RosterVoter[] = [
    ...room.participants
      .filter((p) => p.isVoter)
      .map((p) => ({ id: p.id, name: p.name, hasVoted: p.hasVoted, connected: p.connected, departed: false })),
    ...room.departedVoters.map((d) => ({ id: d.id, name: d.name, hasVoted: d.hasVoted, connected: false, departed: true })),
  ];
  return {
    voters,
    spectators: room.participants.filter((p) => !p.isVoter).map((p) => ({ id: p.id, name: p.name })),
    ballotCount: voters.filter((v) => v.hasVoted).length,
    pendingCount: voters.filter((v) => !v.hasVoted && !v.departed).length,
  };
}
