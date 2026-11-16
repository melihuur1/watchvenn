// The room rules: the whole state machine as plain functions over an in-memory store.
// - Each rule validates first and changes nothing when it returns an error.
// - The acting participant is always an argument, taken from the socket, never from a payload.
// - Time is passed in, so every rule and `sweep` is deterministic under test.
import { randomBytes, randomInt } from 'node:crypto';
import { customMovie, findCatalogMovie } from '../shared/catalog.js';
import { LIMITS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TIMINGS } from '../shared/constants.js';
import type { AddCandidatePayload, ErrorCode, JoinRoomPayload, RoomPreview, SubmitVotePayload } from '../shared/events.js';
import { computeResults } from '../shared/scoring.js';
import { foldKey } from '../shared/text.js';
import { VOTES, type Ballot, type Movie, type Phase, type PublicRoom, type Results } from '../shared/types.js';

export interface Participant {
  id: string;
  /** Secret. Proves identity on rejoin; never broadcast. */
  token: string;
  name: string;
  joinedAt: number;
  /** A set, so two tabs sharing one identity both count. */
  socketIds: Set<string>;
  /** When the last socket dropped; null while connected. */
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  phase: Phase;
  round: number;
  hostId: string;
  /** Insertion order is join order: participants are never re-inserted. */
  participants: Map<string, Participant>;
  /** In the order they were added. */
  candidates: Movie[];
  /** Locked at voting start. Includes voters who later left. */
  voterIds: string[];
  /** Locked voters who left during voting or results, id → name, so they can still be reported. */
  departedVoters: Map<string, string>;
  /** Secret until results. Keyed by participant id. */
  ballots: Map<string, Ballot>;
  results: Results | null;
  createdAt: number;
}

export type RoomStore = Map<string, Room>;

export type RuleResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

interface Joined {
  room: Room;
  participant: Participant;
}

const ok = <T extends object>(value: T): RuleResult<T> => ({ ok: true as const, ...value });
const fail = (error: ErrorCode) => ({ ok: false as const, error });

export function createStore(): RoomStore {
  return new Map();
}

// ── Joining and presence ────────────────────────────────────────────────────

/** `name` must already be cleaned and length-checked (see validation.ts). */
export function createRoom(store: RoomStore, name: string, socketId: string, now: number): RuleResult<Joined> {
  if (store.size >= LIMITS.maxRooms) return fail('SERVER_FULL');

  const participant = newParticipant(name, socketId, now);
  const room: Room = {
    code: uniqueCode(store),
    phase: 'lobby',
    round: 1,
    hostId: participant.id,
    participants: new Map([[participant.id, participant]]),
    candidates: [],
    voterIds: [],
    departedVoters: new Map(),
    ballots: new Map(),
    results: null,
    createdAt: now,
  };
  store.set(room.code, room);
  return ok({ room, participant });
}

export function peekRoom(store: RoomStore, code: string): RuleResult<RoomPreview> {
  const room = store.get(code);
  if (!room) return fail('ROOM_NOT_FOUND');
  return ok({
    hostName: room.participants.get(room.hostId)?.name ?? '',
    phase: room.phase,
    participantCount: room.participants.size,
  });
}

/**
 * With a token: reconnect that identity. With a name: add a new participant, who is a
 * spectator until the next round if voting has already started.
 */
export function joinRoom(store: RoomStore, payload: JoinRoomPayload, socketId: string, now: number): RuleResult<Joined> {
  const room = store.get(payload.code);
  if (!room) return fail('ROOM_NOT_FOUND');

  if ('token' in payload) {
    const participant = [...room.participants.values()].find((p) => p.token === payload.token);
    if (!participant) return fail('SESSION_EXPIRED');
    participant.socketIds.add(socketId);
    participant.disconnectedAt = null;
    return ok({ room, participant });
  }

  if (room.participants.size >= LIMITS.maxParticipants) return fail('ROOM_FULL');
  const key = foldKey(payload.name);
  if ([...room.participants.values()].some((p) => foldKey(p.name) === key)) return fail('NAME_TAKEN');

  const participant = newParticipant(payload.name, socketId, now);
  room.participants.set(participant.id, participant);
  return ok({ room, participant });
}

/** A socket dropped. Returns true when that left the participant with no sockets (a presence change). */
export function detachSocket(room: Room, participantId: string, socketId: string, now: number): boolean {
  const participant = room.participants.get(participantId);
  if (!participant?.socketIds.delete(socketId)) return false;
  if (participant.socketIds.size > 0) return false;
  participant.disconnectedAt = now;
  return true;
}

/**
 * Removes the participant. A locked voter still counts in the voter total and is reported as
 * departed, but the round stops waiting for them. A host's role passes on immediately, and the
 * last one out deletes the room. Returns the sockets that were attached, so they can be unsubscribed.
 */
export function leaveRoom(
  store: RoomStore,
  room: Room,
  actorId: string,
): RuleResult<{ socketIds: string[]; roomDeleted: boolean }> {
  const participant = room.participants.get(actorId);
  if (!participant) return fail('SESSION_EXPIRED');

  room.participants.delete(actorId);
  const socketIds = [...participant.socketIds];

  if (room.participants.size === 0) {
    store.delete(room.code);
    return ok({ socketIds, roomDeleted: true });
  }
  if (room.phase !== 'lobby' && room.voterIds.includes(actorId)) {
    room.departedVoters.set(actorId, participant.name);
  }
  if (room.hostId === actorId) {
    room.hostId = earliestConnected(room)?.id ?? firstParticipant(room).id;
  }
  settleVoting(room);
  return ok({ socketIds, roomDeleted: false });
}

// ── Lobby ───────────────────────────────────────────────────────────────────

export function addCandidate(room: Room, actorId: string, input: AddCandidatePayload): RuleResult<{ movie: Movie }> {
  const denied = checkHost(room, actorId, 'lobby');
  if (denied) return fail(denied);
  if (room.candidates.length >= LIMITS.maxCandidates) return fail('TOO_MANY_CANDIDATES');

  let movie: Movie;
  if ('movieId' in input) {
    const found = findCatalogMovie(input.movieId);
    if (!found) return fail('INVALID_INPUT');
    movie = found;
  } else {
    movie = customMovie(`custom-${randomBytes(6).toString('hex')}`, input.customTitle);
  }
  if (isDuplicate(room.candidates, movie)) return fail('DUPLICATE_CANDIDATE');

  room.candidates.push(movie);
  return ok({ movie });
}

/** Idempotent: removing a movie that isn't listed (a double click) is not an error. */
export function removeCandidate(room: Room, actorId: string, movieId: string): RuleResult {
  const denied = checkHost(room, actorId, 'lobby');
  if (denied) return fail(denied);
  room.candidates = room.candidates.filter((m) => m.id !== movieId);
  return ok({});
}

/** Locks the voter list to the participants connected right now. */
export function startVoting(room: Room, actorId: string): RuleResult {
  const denied = checkHost(room, actorId, 'lobby');
  if (denied) return fail(denied);
  if (room.candidates.length < LIMITS.minCandidates) return fail('TOO_FEW_CANDIDATES');

  room.phase = 'voting';
  room.voterIds = [...room.participants.values()].filter(isConnected).map((p) => p.id);
  room.departedVoters.clear();
  room.ballots.clear();
  room.results = null;
  return ok({});
}

// ── Voting ──────────────────────────────────────────────────────────────────

/** Stores a whole ballot once. The ballot that completes the round computes the results. */
export function submitVote(room: Room, actorId: string, { round, ballot }: SubmitVotePayload): RuleResult {
  if (!room.participants.has(actorId)) return fail('SESSION_EXPIRED');
  if (room.phase !== 'voting' || round !== room.round) return fail('WRONG_PHASE');
  if (!room.voterIds.includes(actorId)) return fail('NOT_A_VOTER');
  if (room.ballots.has(actorId)) return fail('ALREADY_VOTED');

  // Exactly the candidate set, each with a known vote. validation.ts checks the shape too;
  // this keeps the rule safe on its own, since computeResults rejects anything else.
  const coversExactly =
    Object.keys(ballot).length === room.candidates.length &&
    room.candidates.every((m) => Object.hasOwn(ballot, m.id) && VOTES.includes(ballot[m.id]!));
  if (!coversExactly) return fail('INVALID_BALLOT');

  // Store a fresh object so nothing the caller still holds can change it later.
  room.ballots.set(actorId, Object.fromEntries(room.candidates.map((m) => [m.id, ballot[m.id]!])));
  settleVoting(room);
  return ok({});
}

/** Computes results from the ballots submitted so far. */
export function endVoting(room: Room, actorId: string): RuleResult {
  const denied = checkHost(room, actorId, 'voting');
  if (denied) return fail(denied);
  if (room.ballots.size === 0) return fail('NO_BALLOTS');
  finishVoting(room);
  return ok({});
}

/** Throws away every ballot and returns to the lobby without results. */
export function cancelVoting(room: Room, actorId: string): RuleResult {
  const denied = checkHost(room, actorId, 'voting');
  if (denied) return fail(denied);
  resetToLobby(room);
  return ok({});
}

export function newRound(room: Room, actorId: string): RuleResult {
  const denied = checkHost(room, actorId, 'results');
  if (denied) return fail(denied);
  resetToLobby(room);
  return ok({});
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export interface SweepReport {
  /** Rooms that changed and need a fresh broadcast. */
  changed: string[];
  deleted: string[];
}

/**
 * Runs every few seconds: deletes expired rooms, removes people who left the lobby and
 * hands over the host role. One deterministic loop instead of a timer per person.
 */
export function sweep(store: RoomStore, now: number): SweepReport {
  const report: SweepReport = { changed: [], deleted: [] };
  for (const room of store.values()) {
    if (isExpired(room, now)) {
      store.delete(room.code);
      report.deleted.push(room.code);
      continue;
    }
    const removed = removeAwayFromLobby(room, now);
    const handedOver = handOverHostIfAway(room, now);
    if (removed || handedOver) report.changed.push(room.code);
  }
  return report;
}

function isExpired(room: Room, now: number): boolean {
  if (room.participants.size === 0) return true;
  if (now - room.createdAt >= TIMINGS.roomMaxAgeMs) return true;
  const participants = [...room.participants.values()];
  if (participants.some(isConnected)) return false;
  const lastSeen = Math.max(...participants.map((p) => p.disconnectedAt ?? now));
  return now - lastSeen >= TIMINGS.roomIdleMs;
}

/**
 * In the lobby, anyone offline for the grace period is removed (they can rejoin by name).
 * Only while someone is still connected: an all-offline room is kept whole for the idle timeout.
 */
function removeAwayFromLobby(room: Room, now: number): boolean {
  if (room.phase !== 'lobby' || !earliestConnected(room)) return false;
  let removed = false;
  for (const p of room.participants.values()) {
    if (p.disconnectedAt !== null && now - p.disconnectedAt >= TIMINGS.lobbyGraceMs) {
      room.participants.delete(p.id);
      removed = true;
    }
  }
  return removed;
}

/** A host offline for the grace period (a refresh is shorter) hands over to the earliest-joined connected participant. */
function handOverHostIfAway(room: Room, now: number): boolean {
  const host = room.participants.get(room.hostId);
  if (host && (host.disconnectedAt === null || now - host.disconnectedAt < TIMINGS.hostGraceMs)) return false;
  const next = earliestConnected(room) ?? (host ? undefined : firstParticipant(room));
  if (!next) return false;
  room.hostId = next.id;
  return true;
}

// ── Snapshot ────────────────────────────────────────────────────────────────

/** What everyone in the room may see. Tokens and individual ballots stay on the server. */
export function toPublicRoom(room: Room): PublicRoom {
  const voters = new Set(room.voterIds);
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    participants: [...room.participants.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: isConnected(p),
      isVoter: voters.has(p.id),
      hasVoted: room.ballots.has(p.id),
    })),
    departedVoters: [...room.departedVoters].map(([id, name]) => ({ id, name, hasVoted: room.ballots.has(id) })),
    candidates: [...room.candidates],
    results: room.results,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function newParticipant(name: string, socketId: string, now: number): Participant {
  return {
    id: randomBytes(6).toString('base64url'),
    token: randomBytes(16).toString('base64url'), // 128 bits
    name,
    joinedAt: now,
    socketIds: new Set([socketId]),
    disconnectedAt: null,
  };
}

function uniqueCode(store: RoomStore): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!store.has(code)) return code;
  }
}

function isConnected(p: Participant): boolean {
  return p.socketIds.size > 0;
}

function earliestConnected(room: Room): Participant | undefined {
  return [...room.participants.values()].find(isConnected);
}

/** Only called on a non-empty room. */
function firstParticipant(room: Room): Participant {
  return room.participants.values().next().value!;
}

function checkHost(room: Room, actorId: string, phase: Phase): ErrorCode | null {
  if (!room.participants.has(actorId)) return 'SESSION_EXPIRED';
  if (room.hostId !== actorId) return 'NOT_HOST';
  if (room.phase !== phase) return 'WRONG_PHASE';
  return null;
}

/** Same id, or any shared title (Turkish or original), compared case-insensitively with Turkish rules. */
function isDuplicate(candidates: readonly Movie[], movie: Movie): boolean {
  const keys = new Set(titleKeys(movie));
  return candidates.some((c) => c.id === movie.id || titleKeys(c).some((key) => keys.has(key)));
}

function titleKeys(movie: Movie): string[] {
  return movie.kind === 'catalog' ? [foldKey(movie.title), foldKey(movie.originalTitle)] : [foldKey(movie.title)];
}

/** Finishes the round once no present voter is still pending. If nobody voted at all, it's a cancel. */
function settleVoting(room: Room): void {
  if (room.phase !== 'voting') return;
  const waiting = room.voterIds.some((id) => room.participants.has(id) && !room.ballots.has(id));
  if (waiting) return;
  if (room.ballots.size === 0) resetToLobby(room);
  else finishVoting(room);
}

function finishVoting(room: Room): void {
  room.results = computeResults(room.candidates, [...room.ballots.values()], room.voterIds.length);
  room.phase = 'results';
}

/** Back to the lobby with the same candidates. The new round number invalidates old drafts. */
function resetToLobby(room: Room): void {
  room.phase = 'lobby';
  room.round += 1;
  room.voterIds = [];
  room.departedVoters.clear();
  room.ballots.clear();
  room.results = null;
}
