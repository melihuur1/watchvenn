import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS, TIMINGS } from '../shared/constants.js';
import type { ErrorCode } from '../shared/events.js';
import { parseRoomCode } from '../shared/text.js';
import type { Ballot, Vote } from '../shared/types.js';
import {
  addCandidate,
  cancelVoting,
  createRoom,
  createStore,
  detachSocket,
  endVoting,
  joinRoom,
  leaveRoom,
  newRound,
  peekRoom,
  removeCandidate,
  startVoting,
  submitVote,
  sweep,
  toPublicRoom,
  type Participant,
  type Room,
  type RoomStore,
  type RuleResult,
} from './rooms.js';

const T0 = 1_700_000_000_000;
let socketSeq = 0;
const nextSocket = () => `socket-${++socketSeq}`;

function expectOk<T extends object>(result: RuleResult<T>): T {
  if (!result.ok) throw new Error(`Expected success, got ${result.error}`);
  return result;
}

function expectError(result: RuleResult<object>, error: ErrorCode) {
  expect(result).toEqual({ ok: false, error });
}

/** A room whose first name is the host; everyone else joins one millisecond apart. */
function setup(...names: string[]): { store: RoomStore; room: Room; people: Participant[] } {
  const store = createStore();
  const [hostName = 'Ayşe', ...others] = names;
  const { room, participant: host } = expectOk(createRoom(store, hostName, nextSocket(), T0));
  const people = [host];
  others.forEach((name, i) => {
    people.push(expectOk(joinRoom(store, { code: room.code, name }, nextSocket(), T0 + i + 1)).participant);
  });
  return { store, room, people };
}

function addMovies(room: Room, hostId: string, ...movieIds: string[]) {
  for (const movieId of movieIds) expectOk(addCandidate(room, hostId, { movieId }));
}

/** Every candidate gets `vote`, except the ones listed in `overrides`. */
function ballotFor(room: Room, vote: Vote, overrides: Ballot = {}): Ballot {
  return { ...Object.fromEntries(room.candidates.map((m) => [m.id, vote])), ...overrides };
}

function vote(room: Room, voter: Participant, ballot: Ballot = ballotFor(room, 'yes')) {
  return submitVote(room, voter.id, { round: room.round, ballot });
}

/** Drops every socket of a participant at `now`. */
function disconnect(room: Room, participant: Participant, now: number) {
  for (const socketId of [...participant.socketIds]) detachSocket(room, participant.id, socketId, now);
}

const publicParticipant = (room: Room, id: string) => toPublicRoom(room).participants.find((p) => p.id === id)!;

beforeEach(() => {
  socketSeq = 0;
});

describe('createRoom', () => {
  it('creates a lobby with the creator as its connected host', () => {
    const { room, people } = setup('Ayşe');

    expect(parseRoomCode(room.code)).toBe(room.code);
    expect(room).toMatchObject({ phase: 'lobby', round: 1, hostId: people[0]!.id, results: null });
    expect(toPublicRoom(room).participants).toEqual([
      { id: people[0]!.id, name: 'Ayşe', connected: true, isVoter: false, hasVoted: false },
    ]);
  });

  it('issues unique codes and a separate secret token per participant', () => {
    const store = createStore();
    const created = Array.from({ length: 50 }, () => expectOk(createRoom(store, 'Ali', nextSocket(), T0)));

    expect(new Set(created.map((c) => c.room.code)).size).toBe(50);
    const { participant } = created[0]!;
    expect(participant.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(participant.token).not.toBe(participant.id);
  });

  it('refuses new rooms when the server is full', () => {
    const store = createStore();
    for (let i = 0; i < LIMITS.maxRooms; i++) expectOk(createRoom(store, 'Ali', nextSocket(), T0));

    expectError(createRoom(store, 'Ali', nextSocket(), T0), 'SERVER_FULL');
    expect(store.size).toBe(LIMITS.maxRooms);
  });
});

describe('peekRoom', () => {
  it('previews a room for the invite page', () => {
    const { store, room } = setup('Ayşe', 'Ali');
    expect(peekRoom(store, room.code)).toEqual({ ok: true, hostName: 'Ayşe', phase: 'lobby', participantCount: 2 });
  });

  it('reports unknown codes', () => {
    expectError(peekRoom(createStore(), 'K7M2QX'), 'ROOM_NOT_FOUND');
  });
});

describe('joinRoom', () => {
  it('adds participants by name in join order', () => {
    const { room } = setup('Ayşe', 'Ali', 'Zeynep');
    expect(toPublicRoom(room).participants.map((p) => p.name)).toEqual(['Ayşe', 'Ali', 'Zeynep']);
  });

  it('rejects names already taken, ignoring case with Turkish rules', () => {
    const { store, room } = setup('Ayşe', 'İsmail');
    const join = (name: string) => joinRoom(store, { code: room.code, name }, nextSocket(), T0);

    expectError(join('AYŞE'), 'NAME_TAKEN');
    expectError(join('ismail'), 'NAME_TAKEN');
    expectError(join('ISMAIL'), 'NAME_TAKEN'); // caps without the dotted İ
    expect(join('Ayse').ok).toBe(true); // only case is ignored, not other letters
  });

  it(`refuses a ${LIMITS.maxParticipants + 1}th participant`, () => {
    const names = Array.from({ length: LIMITS.maxParticipants }, (_, i) => `Kişi ${i + 1}`);
    const { store, room } = setup(...names);

    expectError(joinRoom(store, { code: room.code, name: 'Fazla' }, nextSocket(), T0), 'ROOM_FULL');
  });

  it('reports unknown rooms', () => {
    expectError(joinRoom(createStore(), { code: 'K7M2QX', name: 'Ali' }, nextSocket(), T0), 'ROOM_NOT_FOUND');
  });

  it('reconnects the same identity with its token, keeping the host role', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const host = people[0]!;
    disconnect(room, host, T0 + 5_000);
    expect(publicParticipant(room, host.id).connected).toBe(false);

    const rejoined = expectOk(joinRoom(store, { code: room.code, token: host.token }, nextSocket(), T0 + 8_000));

    expect(rejoined.participant.id).toBe(host.id);
    expect(room.hostId).toBe(host.id);
    expect(room.participants.size).toBe(2);
    expect(publicParticipant(room, host.id).connected).toBe(true);
  });

  it('tells a client with an unknown token that its session expired', () => {
    const { store, room } = setup('Ayşe');
    expectError(joinRoom(store, { code: room.code, token: 'x'.repeat(22) }, nextSocket(), T0), 'SESSION_EXPIRED');
  });

  it('joins as a spectator once voting has started, and votes from the next round', () => {
    const { store, room, people } = setup('Ayşe');
    const host = people[0]!;
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));

    const late = expectOk(joinRoom(store, { code: room.code, name: 'Geç' }, nextSocket(), T0 + 1)).participant;
    expect(publicParticipant(room, late.id)).toMatchObject({ isVoter: false, hasVoted: false });
    expectError(vote(room, late), 'NOT_A_VOTER');

    expectOk(cancelVoting(room, host.id));
    expectOk(startVoting(room, host.id));
    expect(publicParticipant(room, late.id).isVoter).toBe(true);
    expectOk(vote(room, late));
  });
});

describe('presence', () => {
  it('stays connected while any tab of the same identity is open', () => {
    const { store, room, people } = setup('Ayşe');
    const host = people[0]!;
    const firstSocket = [...host.socketIds][0]!;
    const secondSocket = nextSocket();
    expectOk(joinRoom(store, { code: room.code, token: host.token }, secondSocket, T0));

    expect(detachSocket(room, host.id, firstSocket, T0 + 1)).toBe(false);
    expect(host.disconnectedAt).toBeNull();
    expect(detachSocket(room, host.id, secondSocket, T0 + 2)).toBe(true);
    expect(host.disconnectedAt).toBe(T0 + 2);
    expect(publicParticipant(room, host.id).connected).toBe(false);
  });

  it('ignores sockets it does not know', () => {
    const { room, people } = setup('Ayşe');
    expect(detachSocket(room, people[0]!.id, 'unknown', T0)).toBe(false);
    expect(detachSocket(room, 'nobody', 'unknown', T0)).toBe(false);
  });
});

describe('candidates', () => {
  it('lets the host add catalog movies and custom titles in order', () => {
    const { room, people } = setup('Ayşe');
    addMovies(room, people[0]!.id, 'matrix');
    const { movie } = expectOk(addCandidate(room, people[0]!.id, { customTitle: 'Babamın Ceketi' }));

    expect(movie).toMatchObject({ kind: 'custom', title: 'Babamın Ceketi' });
    expect(movie.id).toMatch(/^custom-[0-9a-f]{12}$/);
    expect(room.candidates.map((m) => m.title)).toEqual(['Matrix', 'Babamın Ceketi']);
  });

  it('is host-only and lobby-only', () => {
    const { room, people } = setup('Ayşe', 'Ali');
    const [host, guest] = people as [Participant, Participant];

    expectError(addCandidate(room, guest.id, { movieId: 'matrix' }), 'NOT_HOST');
    expectError(removeCandidate(room, guest.id, 'matrix'), 'NOT_HOST');

    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectError(addCandidate(room, host.id, { movieId: 'alien' }), 'WRONG_PHASE');
    expectError(removeCandidate(room, host.id, 'matrix'), 'WRONG_PHASE');
  });

  it('rejects duplicates by id and by title, Turkish or original, ignoring case', () => {
    const { room, people } = setup('Ayşe');
    const add = (input: { movieId: string } | { customTitle: string }) => addCandidate(room, people[0]!.id, input);
    addMovies(room, people[0]!.id, 'matrix', 'inception');
    expectOk(add({ customTitle: 'Işıklar Sönmesin' }));

    expectError(add({ movieId: 'matrix' }), 'DUPLICATE_CANDIDATE');
    expectError(add({ customTitle: 'MATRIX' }), 'DUPLICATE_CANDIDATE');
    expectError(add({ customTitle: 'the matrix' }), 'DUPLICATE_CANDIDATE'); // its original title
    expectError(add({ customTitle: 'BAŞLANGIÇ' }), 'DUPLICATE_CANDIDATE');
    expectError(add({ customTitle: 'Inception' }), 'DUPLICATE_CANDIDATE');
    expectError(add({ customTitle: 'IŞIKLAR SÖNMESİN' }), 'DUPLICATE_CANDIDATE');
    expect(room.candidates).toHaveLength(3);
  });

  it('rejects a catalog movie whose title was already added as a custom title', () => {
    const { room, people } = setup('Ayşe');
    expectOk(addCandidate(room, people[0]!.id, { customTitle: 'yukarı bak' }));
    expectError(addCandidate(room, people[0]!.id, { movieId: 'up' }), 'DUPLICATE_CANDIDATE');
  });

  it('rejects unknown catalog ids', () => {
    const { room, people } = setup('Ayşe');
    expectError(addCandidate(room, people[0]!.id, { movieId: 'not-a-movie' }), 'INVALID_INPUT');
  });

  it(`caps the list at ${LIMITS.maxCandidates}`, () => {
    const { room, people } = setup('Ayşe');
    for (let i = 1; i <= LIMITS.maxCandidates; i++) expectOk(addCandidate(room, people[0]!.id, { customTitle: `Film ${i}` }));

    expectError(addCandidate(room, people[0]!.id, { movieId: 'matrix' }), 'TOO_MANY_CANDIDATES');
  });

  it('removes movies, and removing one twice is harmless', () => {
    const { room, people } = setup('Ayşe');
    addMovies(room, people[0]!.id, 'matrix', 'up', 'alien');

    expectOk(removeCandidate(room, people[0]!.id, 'up'));
    expectOk(removeCandidate(room, people[0]!.id, 'up'));
    expect(room.candidates.map((m) => m.id)).toEqual(['matrix', 'alien']);
  });
});

describe('startVoting', () => {
  it(`needs at least ${LIMITS.minCandidates} candidates and the host`, () => {
    const { room, people } = setup('Ayşe', 'Ali');
    addMovies(room, people[0]!.id, 'matrix');

    expectError(startVoting(room, people[0]!.id), 'TOO_FEW_CANDIDATES');
    addMovies(room, people[0]!.id, 'up');
    expectError(startVoting(room, people[1]!.id), 'NOT_HOST');
    expectOk(startVoting(room, people[0]!.id));
    expectError(startVoting(room, people[0]!.id), 'WRONG_PHASE');
  });

  it('locks the voter list to the participants connected right now', () => {
    const { room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali, zeynep] = people as [Participant, Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    disconnect(room, zeynep, T0 + 10);

    expectOk(startVoting(room, host.id));

    expect(room.phase).toBe('voting');
    expect(room.voterIds).toEqual([host.id, ali.id]);
    expect(publicParticipant(room, zeynep.id).isVoter).toBe(false);
  });
});

describe('submitVote', () => {
  function votingRoom() {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    addMovies(room, people[0]!.id, 'matrix', 'up', 'alien');
    expectOk(startVoting(room, people[0]!.id));
    return { store, room, people: people as [Participant, Participant, Participant] };
  }

  it('stores one ballot per voter and shows who has voted, not how', () => {
    const { room, people } = votingRoom();
    const [host, ali] = people;
    expectOk(vote(room, ali, ballotFor(room, 'neutral', { alien: 'veto' })));

    expect(publicParticipant(room, ali.id).hasVoted).toBe(true);
    expect(publicParticipant(room, host.id).hasVoted).toBe(false);
    const snapshot = JSON.stringify(toPublicRoom(room));
    expect(snapshot).not.toContain('veto');
    expect(snapshot).not.toContain('neutral');
    for (const p of people) expect(snapshot).not.toContain(p.token);
  });

  it('accepts only one submission per identity, from any tab', () => {
    const { store, room, people } = votingRoom();
    const ali = people[1];
    expectOk(joinRoom(store, { code: room.code, token: ali.token }, nextSocket(), T0)); // second tab
    expectOk(vote(room, ali, ballotFor(room, 'yes')));

    expectError(vote(room, ali, ballotFor(room, 'veto')), 'ALREADY_VOTED');
    expect(room.ballots.get(ali.id)).toEqual(ballotFor(room, 'yes'));
  });

  it('rejects ballots that do not cover exactly the candidates, storing nothing', () => {
    const { room, people } = votingRoom();
    const ali = people[1];
    const { alien: _dropped, ...missing } = ballotFor(room, 'yes');

    expectError(vote(room, ali, missing), 'INVALID_BALLOT');
    expectError(vote(room, ali, { ...missing, inception: 'yes' }), 'INVALID_BALLOT');
    expectError(vote(room, ali, { ...ballotFor(room, 'yes'), inception: 'yes' }), 'INVALID_BALLOT');
    expectError(vote(room, ali, ballotFor(room, 'yes', { up: 'maybe' as Vote })), 'INVALID_BALLOT');
    expect(room.ballots.size).toBe(0);
  });

  it('rejects a ballot from another round or outside voting', () => {
    const { room, people } = votingRoom();
    const ali = people[1];

    expectError(submitVote(room, ali.id, { round: room.round + 1, ballot: ballotFor(room, 'yes') }), 'WRONG_PHASE');
    expectOk(cancelVoting(room, people[0].id));
    expectError(vote(room, ali), 'WRONG_PHASE');
  });

  it('computes results when the last voter submits', () => {
    const { room, people } = votingRoom();
    const [host, ali, zeynep] = people;
    expectOk(vote(room, host, ballotFor(room, 'yes')));
    expectOk(vote(room, ali, ballotFor(room, 'neutral', { matrix: 'veto' })));
    expect(room.phase).toBe('voting');

    expectOk(vote(room, zeynep, ballotFor(room, 'yes', { alien: 'neutral' })));

    expect(room.phase).toBe('results');
    expect(room.results).toMatchObject({ status: 'match', voterCount: 3, ballotCount: 3, excludedCount: 0 });
    expect(room.results!.top.map((r) => r.movie.id)).toEqual(['up', 'alien']);
    expect(toPublicRoom(room).results).toEqual(room.results);
  });
});

describe('endVoting', () => {
  it('needs the host and at least one ballot', () => {
    const { room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectError(endVoting(room, host.id), 'WRONG_PHASE');
    expectOk(startVoting(room, host.id));

    expectError(endVoting(room, host.id), 'NO_BALLOTS');
    expectOk(vote(room, ali));
    expectError(endVoting(room, ali.id), 'NOT_HOST');
  });

  it('computes results from the submitted ballots only and reports the turnout', () => {
    const { room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectOk(vote(room, ali, ballotFor(room, 'yes', { up: 'veto' })));

    expectOk(endVoting(room, host.id));

    expect(room.phase).toBe('results');
    expect(room.results).toMatchObject({ voterCount: 3, ballotCount: 1, excludedCount: 2 });
    expect(room.results!.top.map((r) => [r.movie.id, r.compatibility])).toEqual([['matrix', 100]]);
  });
});

describe('cancelVoting and newRound', () => {
  it('cancel returns to the lobby without results, keeping the candidates', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectError(cancelVoting(room, ali.id), 'NOT_HOST');
    const spectator = expectOk(joinRoom(store, { code: room.code, name: 'Geç' }, nextSocket(), T0)).participant;

    expectOk(cancelVoting(room, host.id)); // allowed with zero ballots

    expect(room).toMatchObject({ phase: 'lobby', round: 2, results: null, voterIds: [] });
    expect(room.ballots.size).toBe(0);
    expect(room.candidates.map((m) => m.id)).toEqual(['matrix', 'up']);
    expect(publicParticipant(room, spectator.id).isVoter).toBe(false);
    expectError(cancelVoting(room, host.id), 'WRONG_PHASE');
  });

  it('new round goes from results back to the lobby, keeping the candidates', () => {
    const { room, people } = setup('Ayşe');
    const host = people[0]!;
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectError(newRound(room, host.id), 'WRONG_PHASE');
    expectOk(vote(room, host));
    expect(room.phase).toBe('results');

    expectOk(newRound(room, host.id));

    expect(room).toMatchObject({ phase: 'lobby', round: 2, results: null, voterIds: [] });
    expect(room.ballots.size).toBe(0);
    expect(room.candidates).toHaveLength(2);
  });
});

describe('leaveRoom', () => {
  it('removes the participant and returns their sockets', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const ali = people[1]!;
    const sockets = [...ali.socketIds];

    expect(expectOk(leaveRoom(store, room, ali.id))).toEqual({ ok: true, socketIds: sockets, roomDeleted: false });
    expect(room.participants.has(ali.id)).toBe(false);
    expectError(leaveRoom(store, room, ali.id), 'SESSION_EXPIRED');
  });

  it('passes the host role on immediately, to the earliest-joined connected participant', () => {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali, zeynep] = people as [Participant, Participant, Participant];
    disconnect(room, ali, T0 + 10);

    expectOk(leaveRoom(store, room, host.id));
    expect(room.hostId).toBe(zeynep.id);
  });

  it('deletes the room when the last participant leaves', () => {
    const { store, room, people } = setup('Ayşe');
    expect(expectOk(leaveRoom(store, room, people[0]!.id)).roomDeleted).toBe(true);
    expect(store.has(room.code)).toBe(false);
  });

  it('stops waiting for a voter who leaves, but still counts them in the voter total', () => {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali, zeynep] = people as [Participant, Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectOk(vote(room, host));
    expectOk(vote(room, ali));

    expectOk(leaveRoom(store, room, zeynep.id));

    expect(room.phase).toBe('results');
    expect(room.results).toMatchObject({ voterCount: 3, ballotCount: 2, excludedCount: 1 });
    expect(toPublicRoom(room).departedVoters).toEqual([{ id: zeynep.id, name: 'Zeynep', hasVoted: false }]);
  });

  it('keeps the ballot of a voter who already voted and then left', () => {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    expectOk(vote(room, ali, ballotFor(room, 'yes', { up: 'veto' })));

    expectOk(leaveRoom(store, room, ali.id));

    expect(room.phase).toBe('voting');
    expect(toPublicRoom(room).departedVoters).toEqual([{ id: ali.id, name: 'Ali', hasVoted: true }]);
    expectOk(endVoting(room, host.id));
    expect(room.results).toMatchObject({ ballotCount: 1, voterCount: 3 });
    expect(room.results!.top.map((r) => r.movie.id)).toEqual(['matrix']);
  });

  it('returns to the lobby if every voter leaves before anyone votes', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    const spectator = expectOk(joinRoom(store, { code: room.code, name: 'Geç' }, nextSocket(), T0)).participant;

    expectOk(leaveRoom(store, room, host.id));
    expect(room.hostId).toBe(ali.id);
    expectOk(leaveRoom(store, room, ali.id));

    expect(room).toMatchObject({ phase: 'lobby', round: 2, hostId: spectator.id, results: null });
    expect(toPublicRoom(room).departedVoters).toEqual([]);
  });
});

describe('sweep', () => {
  it(`hands the host role over after ${TIMINGS.hostGraceMs / 1000} s offline, not before`, () => {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [host, ali, zeynep] = people as [Participant, Participant, Participant];
    const offlineAt = T0 + 1_000;
    disconnect(room, host, offlineAt);
    disconnect(room, ali, offlineAt);

    expect(sweep(store, offlineAt + TIMINGS.hostGraceMs - 1).changed).toEqual([]);
    expect(room.hostId).toBe(host.id);

    expect(sweep(store, offlineAt + TIMINGS.hostGraceMs)).toEqual({ changed: [room.code], deleted: [] });
    expect(room.hostId).toBe(zeynep.id); // Ali joined earlier but is offline
  });

  it('keeps the host role across a refresh inside the grace period', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const host = people[0]!;
    disconnect(room, host, T0);
    expectOk(joinRoom(store, { code: room.code, token: host.token }, nextSocket(), T0 + 2_000));

    sweep(store, T0 + TIMINGS.hostGraceMs * 2);
    expect(room.hostId).toBe(host.id);
  });

  it('hands over during voting too, without touching the voter list', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    disconnect(room, host, T0);

    sweep(store, T0 + TIMINGS.hostGraceMs);

    expect(room.hostId).toBe(ali.id);
    expect(room.voterIds).toEqual([host.id, ali.id]);
    expect(room.participants.has(host.id)).toBe(true);
  });

  it('keeps the host when nobody else is connected', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    for (const p of people) disconnect(room, p, T0);

    sweep(store, T0 + TIMINGS.hostGraceMs);
    expect(room.hostId).toBe(people[0]!.id);
  });

  it(`removes people offline for ${TIMINGS.lobbyGraceMs / 1000} s from the lobby`, () => {
    const { store, room, people } = setup('Ayşe', 'Ali', 'Zeynep');
    const [, ali, zeynep] = people as [Participant, Participant, Participant];
    disconnect(room, ali, T0);
    disconnect(room, zeynep, T0 + 30_000);

    sweep(store, T0 + TIMINGS.lobbyGraceMs);

    expect(room.participants.has(ali.id)).toBe(false);
    expect(room.participants.has(zeynep.id)).toBe(true);
  });

  it('never removes voters during voting or results', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    const [host, ali] = people as [Participant, Participant];
    addMovies(room, host.id, 'matrix', 'up');
    expectOk(startVoting(room, host.id));
    disconnect(room, ali, T0);

    sweep(store, T0 + TIMINGS.lobbyGraceMs * 5);
    expect(room.participants.has(ali.id)).toBe(true);

    expectOk(vote(room, host));
    expectOk(endVoting(room, host.id));
    sweep(store, T0 + TIMINGS.lobbyGraceMs * 10);
    expect(room.phase).toBe('results');
    expect(room.participants.has(ali.id)).toBe(true);
  });

  it('keeps an all-offline lobby whole until the idle timeout', () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    for (const p of people) disconnect(room, p, T0);

    sweep(store, T0 + TIMINGS.roomIdleMs - 1);

    expect(store.has(room.code)).toBe(true);
    expect(room.participants.size).toBe(2);
  });

  it(`deletes a room nobody has been connected to for ${TIMINGS.roomIdleMs / 60_000} min`, () => {
    const { store, room, people } = setup('Ayşe', 'Ali');
    disconnect(room, people[0]!, T0);
    disconnect(room, people[1]!, T0 + 60_000); // the last one to leave starts the clock

    expect(sweep(store, T0 + TIMINGS.roomIdleMs).deleted).toEqual([]);
    expect(sweep(store, T0 + 60_000 + TIMINGS.roomIdleMs)).toEqual({ changed: [], deleted: [room.code] });
    expect(store.has(room.code)).toBe(false);
  });

  it(`deletes a room older than ${TIMINGS.roomMaxAgeMs / 3_600_000} h even while people are connected`, () => {
    const { store, room } = setup('Ayşe');

    expect(sweep(store, T0 + TIMINGS.roomMaxAgeMs - 1).deleted).toEqual([]);
    expect(sweep(store, T0 + TIMINGS.roomMaxAgeMs).deleted).toEqual([room.code]);
  });
});
