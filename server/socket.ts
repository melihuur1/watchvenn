// The socket layer, deliberately thin: validate the payload, run the rule from rooms.ts,
// acknowledge, then broadcast the full snapshot of every room that changed.
// The acting participant comes from `socket.data`, which only create and join can set.
import type { Server, Socket } from 'socket.io';
import { LIMITS } from '../shared/constants.js';
import type {
  AckResponse,
  ClientToServerEvents,
  ErrorCode,
  ServerToClientEvents,
  Session,
  SocketData,
} from '../shared/events.js';
import {
  addCandidate,
  cancelVoting,
  createRoom,
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
  type SweepReport,
} from './rooms.js';
import {
  parseAddCandidate,
  parseCreateRoom,
  parseJoinRoom,
  parsePeekRoom,
  parseRemoveCandidate,
  parseSubmitVote,
} from './validation.js';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** What a handler gets: the socket, the raw payload, and a set to mark rooms that need a broadcast. */
interface Context {
  socket: IoSocket;
  payload: unknown;
  changed: Set<Room>;
}

type Handler = (ctx: Context) => AckResponse;
type Rule = (room: Room, actorId: string) => RuleResult;

const OK: AckResponse = { ok: true };
const fail = (error: ErrorCode): AckResponse<never> => ({ ok: false, error });

export interface Realtime {
  /** One cleanup pass (see rooms.ts `sweep`), broadcasting every room that changed. */
  sweep(): void;
}

export function attachRealtime(io: IoServer, store: RoomStore, now: () => number = Date.now): Realtime {
  /** When each connection created its recent rooms, for LIMITS.maxRoomCreatesPerMinute. */
  const roomCreations = new WeakMap<IoSocket, number[]>();

  function broadcast(room: Room) {
    io.to(room.code).emit('room:state', toPublicRoom(room));
  }

  /** Records a creation attempt; false when this connection is over its per-minute allowance. */
  function allowRoomCreation(socket: IoSocket): boolean {
    const time = now();
    const recent = (roomCreations.get(socket) ?? []).filter((t) => time - t < 60_000);
    if (recent.length >= LIMITS.maxRoomCreatesPerMinute) return false;
    roomCreations.set(socket, [...recent, time]);
    return true;
  }

  function currentRoom(socket: IoSocket): Room | undefined {
    const { roomCode } = socket.data;
    return roomCode ? store.get(roomCode) : undefined;
  }

  /** Detaches the socket from whatever identity it was attached to. */
  function exit(socket: IoSocket, changed: Set<Room>) {
    const { roomCode, participantId } = socket.data;
    socket.data = {};
    if (!roomCode || !participantId) return;
    void socket.leave(roomCode);
    const room = store.get(roomCode);
    if (room && detachSocket(room, participantId, socket.id, now())) changed.add(room);
  }

  function admit({ socket, changed }: Context, room: Room, participant: Participant): AckResponse<Session> {
    socket.data = { roomCode: room.code, participantId: participant.id };
    void socket.join(room.code);
    changed.add(room);
    return { ok: true, code: room.code, participantId: participant.id, token: participant.token };
  }

  /** Runs a rule as the socket's participant and marks the room for a broadcast on success. */
  function act({ socket, changed }: Context, rule: Rule): AckResponse {
    const room = currentRoom(socket);
    const actorId = socket.data.participantId;
    if (!room || !actorId) return fail('ROOM_NOT_FOUND');
    const result = rule(room, actorId);
    if (!result.ok) return result;
    changed.add(room);
    return OK;
  }

  function actWith<T>(
    ctx: Context,
    parse: (raw: unknown) => T | null,
    invalid: ErrorCode,
    rule: (room: Room, actorId: string, input: T) => RuleResult,
  ): AckResponse {
    const input = parse(ctx.payload);
    if (input === null) return fail(invalid);
    return act(ctx, (room, actorId) => rule(room, actorId, input));
  }

  const handlers: Record<keyof ClientToServerEvents, Handler> = {
    'room:create': (ctx) => {
      const input = parseCreateRoom(ctx.payload);
      if (!input) return fail('INVALID_INPUT');
      if (!allowRoomCreation(ctx.socket)) return fail('RATE_LIMITED');
      exit(ctx.socket, ctx.changed);
      const result = createRoom(store, input.name, ctx.socket.id, now());
      return result.ok ? admit(ctx, result.room, result.participant) : result;
    },

    'room:peek': (ctx) => {
      const input = parsePeekRoom(ctx.payload);
      return input ? peekRoom(store, input.code) : fail('INVALID_INPUT');
    },

    'room:join': (ctx) => {
      const input = parseJoinRoom(ctx.payload);
      if (!input) return fail('INVALID_INPUT');
      // A rejoin from the same socket detaches and re-attaches within this one event,
      // so the broadcast afterwards never shows the participant as briefly offline.
      exit(ctx.socket, ctx.changed);
      const result = joinRoom(store, input, ctx.socket.id, now());
      return result.ok ? admit(ctx, result.room, result.participant) : result;
    },

    'room:leave': (ctx) =>
      act(ctx, (room, actorId) => {
        const result = leaveRoom(store, room, actorId);
        if (!result.ok) return result;
        // Every tab of this identity stops receiving the room.
        for (const socketId of result.socketIds) {
          const socket = io.sockets.sockets.get(socketId);
          if (!socket) continue;
          socket.data = {};
          void socket.leave(room.code);
        }
        return result;
      }),

    'candidates:add': (ctx) => actWith(ctx, parseAddCandidate, 'INVALID_INPUT', addCandidate),
    'candidates:remove': (ctx) =>
      actWith(ctx, parseRemoveCandidate, 'INVALID_INPUT', (room, actorId, input) =>
        removeCandidate(room, actorId, input.movieId),
      ),
    'voting:start': (ctx) => act(ctx, startVoting),
    'vote:submit': (ctx) => actWith(ctx, parseSubmitVote, 'INVALID_BALLOT', submitVote),
    'voting:end': (ctx) => act(ctx, endVoting),
    'voting:cancel': (ctx) => act(ctx, cancelVoting),
    'round:new': (ctx) => act(ctx, newRound),
  };

  io.on('connection', (socket) => {
    for (const [event, handler] of Object.entries(handlers) as [keyof ClientToServerEvents, Handler][]) {
      // Payloads are untrusted: the typed signatures describe well-behaved clients only.
      socket.on(event, (...args: unknown[]) => {
        const ack = args.at(-1);
        if (typeof ack !== 'function') return; // every action must be acknowledged
        const ctx: Context = { socket, payload: args.length > 1 ? args[0] : undefined, changed: new Set() };

        let reply: AckResponse;
        try {
          reply = handler(ctx);
        } catch (error) {
          // A bug in one handler must not take every room down with the process.
          console.error(`Handler for "${event}" failed`, error);
          reply = fail('INVALID_INPUT');
        }
        ack(reply);
        for (const room of ctx.changed) {
          if (store.get(room.code) === room) broadcast(room);
        }
      });
    }

    socket.on('disconnect', () => {
      const changed = new Set<Room>();
      exit(socket, changed);
      for (const room of changed) broadcast(room);
    });
  });

  return {
    sweep() {
      let report: SweepReport;
      try {
        report = sweep(store, now());
      } catch (error) {
        // Never let the cleanup timer take the process (and every room) down.
        console.error('Room sweep failed', error);
        return;
      }
      for (const code of report.changed) {
        const room = store.get(code);
        if (room) broadcast(room);
      }
      // Anyone still subscribed to an expired room stops receiving it; their next action gets ROOM_NOT_FOUND.
      for (const code of report.deleted) io.in(code).socketsLeave(code);
    },
  };
}
