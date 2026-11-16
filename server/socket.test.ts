// Integration test: real socket.io-client connections against the real handlers,
// with a controllable clock so the sweep can be driven without waiting.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS, TIMINGS } from '../shared/constants.js';
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from '../shared/events.js';
import type { Ballot, PublicRoom } from '../shared/types.js';
import { createStore } from './rooms.js';
import { attachRealtime, type IoServer, type Realtime } from './socket.js';

type ClientSocketTyped = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

interface Player {
  socket: ClientSocketTyped;
  /** Every snapshot this client has received, oldest first. */
  states: PublicRoom[];
  /** Resolves once the latest snapshot matches. */
  until(predicate: (room: PublicRoom) => boolean): Promise<PublicRoom>;
}

const T0 = 1_700_000_000_000;
let io: IoServer;
let realtime: Realtime;
let url: string;
let clock: number;
const sockets: ClientSocketTyped[] = [];

beforeEach(async () => {
  clock = T0;
  const httpServer = createServer();
  io = new Server(httpServer, { maxHttpBufferSize: LIMITS.maxMessageBytes });
  realtime = attachRealtime(io, createStore(), () => clock);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  await io.close();
});

async function connect(): Promise<Player> {
  const socket: ClientSocketTyped = connectClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  sockets.push(socket);
  const states: PublicRoom[] = [];
  socket.on('room:state', (room) => states.push(room));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return {
    socket,
    states,
    until: (predicate) =>
      vi.waitFor(() => {
        const latest = states.at(-1);
        if (!latest || !predicate(latest)) throw new Error('Expected room:state not received yet');
        return latest;
      }),
  };
}

function ok<T extends object>(response: AckResponse<T>): T {
  if (!response.ok) throw new Error(`Expected success, got ${response.error}`);
  return response;
}

/** A room with Ayşe as host and Ali as guest, both connected. */
async function twoPlayerRoom() {
  const ayse = await connect();
  const host = ok(await ayse.socket.emitWithAck('room:create', { name: 'Ayşe' }));
  const ali = await connect();
  const guest = ok(await ali.socket.emitWithAck('room:join', { code: host.code, name: 'Ali' }));
  await ayse.until((r) => r.participants.length === 2);
  return { ayse, ali, host, guest };
}

const participant = (room: PublicRoom, id: string) => room.participants.find((p) => p.id === id);

describe('socket integration', () => {
  it('plays a full round: create → join → add → start → vote → results → reconnect', async () => {
    const ayse = await connect();
    const host = ok(await ayse.socket.emitWithAck('room:create', { name: 'Ayşe' }));
    expect(host.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    await ayse.until((r) => r.hostId === host.participantId);

    // Ali opens the invite link: the code is case-insensitive.
    const ali = await connect();
    expect(await ali.socket.emitWithAck('room:peek', { code: host.code.toLowerCase() })).toEqual({
      ok: true,
      hostName: 'Ayşe',
      phase: 'lobby',
      participantCount: 1,
    });
    const guest = ok(await ali.socket.emitWithAck('room:join', { code: host.code, name: 'Ali' }));
    await ayse.until((r) => r.participants.map((p) => p.name).join() === 'Ayşe,Ali');

    // The host builds the list; Ali sees each movie appear and can't add his own.
    ok(await ayse.socket.emitWithAck('candidates:add', { movieId: 'matrix' }));
    ok(await ayse.socket.emitWithAck('candidates:add', { movieId: 'up' }));
    ok(await ayse.socket.emitWithAck('candidates:add', { customTitle: 'Babamın Ceketi' }));
    expect(await ali.socket.emitWithAck('candidates:add', { movieId: 'alien' })).toEqual({ ok: false, error: 'NOT_HOST' });
    const lobby = await ali.until((r) => r.candidates.length === 3);
    const [matrix, up, custom] = lobby.candidates.map((m) => m.id) as [string, string, string];

    ok(await ayse.socket.emitWithAck('voting:start'));
    const voting = await ali.until((r) => r.phase === 'voting');
    expect(voting.participants.every((p) => p.isVoter)).toBe(true);

    // One ballot each; Ayşe sees Ali's ✓ but never his votes.
    const aliBallot: Ballot = { [matrix]: 'yes', [up]: 'neutral', [custom]: 'veto' };
    ok(await ali.socket.emitWithAck('vote:submit', { round: voting.round, ballot: aliBallot }));
    await ayse.until((r) => participant(r, guest.participantId)?.hasVoted === true);
    expect(await ali.socket.emitWithAck('vote:submit', { round: voting.round, ballot: aliBallot })).toEqual({
      ok: false,
      error: 'ALREADY_VOTED',
    });

    // The last ballot computes the results for everyone.
    const ayseBallot: Ballot = { [matrix]: 'yes', [up]: 'yes', [custom]: 'yes' };
    ok(await ayse.socket.emitWithAck('vote:submit', { round: voting.round, ballot: ayseBallot }));
    const done = await ali.until((r) => r.phase === 'results');
    expect(done.results).toMatchObject({ status: 'match', voterCount: 2, ballotCount: 2, excludedCount: 0 });
    expect(done.results!.top.map((r) => [r.movie.id, r.compatibility])).toEqual([
      [matrix, 100],
      [up, 75],
    ]);

    // Ali's connection drops; Ayşe sees him go grey, then a new socket rejoins with his token.
    ali.socket.disconnect();
    await ayse.until((r) => participant(r, guest.participantId)?.connected === false);
    const aliAgain = await connect();
    const rejoined = ok(await aliAgain.socket.emitWithAck('room:join', { code: host.code, token: guest.token }));
    expect(rejoined.participantId).toBe(guest.participantId);
    const restored = await aliAgain.until((r) => r.phase === 'results');
    expect(restored.results).toEqual(done.results);
    await ayse.until((r) => r.participants.every((p) => p.connected));

    // No snapshot ever carried a token.
    for (const state of [...ayse.states, ...ali.states, ...aliAgain.states]) {
      const json = JSON.stringify(state);
      expect(json).not.toContain(host.token);
      expect(json).not.toContain(guest.token);
    }
  });

  it('ends early, starts a new round and cancels voting', async () => {
    const { ayse, ali, guest } = await twoPlayerRoom();
    ok(await ayse.socket.emitWithAck('candidates:add', { movieId: 'matrix' }));
    ok(await ayse.socket.emitWithAck('candidates:add', { movieId: 'up' }));
    ok(await ayse.socket.emitWithAck('voting:start'));
    const voting = await ali.until((r) => r.phase === 'voting');

    expect(await ayse.socket.emitWithAck('voting:end')).toEqual({ ok: false, error: 'NO_BALLOTS' });
    ok(await ali.socket.emitWithAck('vote:submit', { round: voting.round, ballot: { matrix: 'yes', up: 'veto' } }));
    await ayse.until((r) => participant(r, guest.participantId)?.hasVoted === true);
    ok(await ayse.socket.emitWithAck('voting:end'));
    const early = await ali.until((r) => r.phase === 'results');
    expect(early.results).toMatchObject({ voterCount: 2, ballotCount: 1, excludedCount: 1 });

    ok(await ayse.socket.emitWithAck('round:new'));
    const nextRound = await ali.until((r) => r.phase === 'lobby');
    expect(nextRound).toMatchObject({ round: voting.round + 1, results: null });
    expect(nextRound.candidates).toHaveLength(2);

    ok(await ayse.socket.emitWithAck('voting:start'));
    await ali.until((r) => r.phase === 'voting');
    ok(await ayse.socket.emitWithAck('voting:cancel'));
    expect(await ali.until((r) => r.phase === 'lobby')).toMatchObject({ round: voting.round + 2, results: null });
  });

  it('does not flicker offline when the same socket rejoins its own identity', async () => {
    const ayse = await connect();
    const host = ok(await ayse.socket.emitWithAck('room:create', { name: 'Ayşe' }));
    await ayse.until((r) => r.participants.length === 1);

    ok(await ayse.socket.emitWithAck('room:join', { code: host.code, token: host.token }));
    await vi.waitFor(() => expect(ayse.states.length).toBeGreaterThanOrEqual(2));

    expect(ayse.states.every((r) => r.participants.length === 1 && r.participants[0]!.connected)).toBe(true);
  });

  it('hands the host role over after the grace period', async () => {
    const { ayse, ali, guest } = await twoPlayerRoom();
    ayse.socket.disconnect();
    await ali.until((r) => !r.participants[0]!.connected);

    clock += TIMINGS.hostGraceMs - 1;
    realtime.sweep();
    clock += 1;
    realtime.sweep();

    const handedOver = await ali.until((r) => r.hostId === guest.participantId);
    expect(ali.states.filter((r) => r.hostId === guest.participantId)).toHaveLength(1);
    expect(await ali.socket.emitWithAck('candidates:add', { movieId: 'matrix' })).toEqual({ ok: true });
    expect(handedOver.participants.map((p) => p.name)).toEqual(['Ayşe', 'Ali']);
  });

  it('detaches every tab of a participant who leaves', async () => {
    const { ayse, ali, host, guest } = await twoPlayerRoom();
    const aliSecondTab = await connect();
    ok(await aliSecondTab.socket.emitWithAck('room:join', { code: host.code, token: guest.token }));

    ok(await ali.socket.emitWithAck('room:leave'));

    await ayse.until((r) => r.participants.length === 1);
    expect(await ali.socket.emitWithAck('voting:start')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(await aliSecondTab.socket.emitWithAck('voting:start')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(await aliSecondTab.socket.emitWithAck('room:join', { code: host.code, token: guest.token })).toEqual({
      ok: false,
      error: 'SESSION_EXPIRED',
    });
  });

  it('rejects bad input with error codes and keeps serving', async () => {
    const stranger = await connect();
    // Untyped views of the socket, to send what a well-behaved client never would.
    const emitRaw = stranger.socket.emit.bind(stranger.socket) as unknown as (event: string, ...args: unknown[]) => void;
    const emitRawWithAck = stranger.socket.emitWithAck.bind(stranger.socket) as unknown as (
      event: string,
      ...args: unknown[]
    ) => Promise<unknown>;

    // Not in a room yet.
    expect(await stranger.socket.emitWithAck('voting:start')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    // Malformed payloads.
    expect(await stranger.socket.emitWithAck('room:create', { name: '   ' })).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(await stranger.socket.emitWithAck('room:join', { code: 'nope', name: 'Ali' })).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
    });
    expect(await stranger.socket.emitWithAck('vote:submit', { round: 1, ballot: { matrix: 'maybe' } } as never)).toEqual({
      ok: false,
      error: 'INVALID_BALLOT',
    });
    // Well-formed but unknown.
    expect(await stranger.socket.emitWithAck('room:peek', { code: 'K7M2QX' })).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(await stranger.socket.emitWithAck('room:join', { code: 'K7M2QX', token: 'A'.repeat(22) })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });

    // An event without an acknowledgement is ignored rather than half-applied.
    emitRaw('room:create', { name: 'Hayalet' });
    // A payload that is not even an object.
    expect(await emitRawWithAck('room:create', 42)).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(await emitRawWithAck('voting:start', 'junk', 'more junk')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });

    // Still serving, and the ack-less create did not put the stranger in a room.
    expect(await stranger.socket.emitWithAck('voting:start')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(stranger.states).toEqual([]);
  });
});
