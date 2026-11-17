// The Socket.IO contract. Client and server both type their sockets with these maps,
// so a renamed event or a changed payload is a compile error on both sides.
import type { Ballot, Phase, PublicRoom } from './types.js';

export const ERROR_CODES = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'SERVER_FULL',
  /** Too many rooms created from one connection in the last minute. */
  'RATE_LIMITED',
  /** The token isn't known in this room (e.g. removed from the lobby while offline). Rejoin by name. */
  'SESSION_EXPIRED',
  'NAME_TAKEN',
  'INVALID_INPUT',
  'NOT_HOST',
  'WRONG_PHASE',
  'NOT_A_VOTER',
  'ALREADY_VOTED',
  'INVALID_BALLOT',
  /** Ending voting early needs at least one submitted ballot. */
  'NO_BALLOTS',
  'TOO_FEW_CANDIDATES',
  'TOO_MANY_CANDIDATES',
  'DUPLICATE_CANDIDATE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Every client action is acknowledged with one of these. */
export type AckResponse<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };
export type Ack<T extends object = object> = (response: AckResponse<T>) => void;

export interface CreateRoomPayload {
  name: string;
}

export interface PeekRoomPayload {
  code: string;
}

/** With a token: reconnect that identity. With a name: join as a new participant. */
export type JoinRoomPayload = { code: string; token: string } | { code: string; name: string };

export type AddCandidatePayload = { movieId: string } | { customTitle: string };

export interface RemoveCandidatePayload {
  movieId: string;
}

export interface SubmitVotePayload {
  /** Must match the room's current round, so a stale draft can't be counted. */
  round: number;
  ballot: Ballot;
}

/** Returned by create and join. The token is a secret: store it, never show it. */
export interface Session {
  code: string;
  participantId: string;
  token: string;
}

/** What the invite page shows before someone joins. */
export interface RoomPreview {
  hostName: string;
  phase: Phase;
  participantCount: number;
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: Ack<Session>) => void;
  'room:peek': (payload: PeekRoomPayload, ack: Ack<RoomPreview>) => void;
  'room:join': (payload: JoinRoomPayload, ack: Ack<Session>) => void;
  'room:leave': (ack: Ack) => void;
  'candidates:add': (payload: AddCandidatePayload, ack: Ack) => void;
  'candidates:remove': (payload: RemoveCandidatePayload, ack: Ack) => void;
  'voting:start': (ack: Ack) => void;
  'vote:submit': (payload: SubmitVotePayload, ack: Ack) => void;
  'voting:end': (ack: Ack) => void;
  'voting:cancel': (ack: Ack) => void;
  'round:new': (ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: PublicRoom) => void;
}

/** Set by the server after a successful create or join. The acting participant always comes from here. */
export interface SocketData {
  roomCode?: string;
  participantId?: string;
}
