import { describe, expect, it } from 'vitest';
import type { PublicRoom } from '@shared/types';
import { RoomConnection } from './roomConnection';
import type { SessionStore, StoredSession } from './session';
import type { EventName, Requester, Transport } from './socket';

interface PendingRequest {
  event: EventName;
  payload: unknown;
  resolve(reply: unknown): void;
  reject(error: Error): void;
}

/** A transport the test drives by hand: connect, disconnect, push snapshots, answer requests. */
class FakeTransport implements Transport {
  connected = true;
  requests: PendingRequest[] = [];
  private connectListeners = new Set<() => void>();
  private disconnectListeners = new Set<() => void>();
  private stateListeners = new Set<(room: PublicRoom) => void>();

  isConnected = () => this.connected;
  onConnect = (listener: () => void) => this.listen(this.connectListeners, listener);
  onDisconnect = (listener: () => void) => this.listen(this.disconnectListeners, listener);
  onState = (listener: (room: PublicRoom) => void) => this.listen(this.stateListeners, listener);

  request = ((event: EventName, ...args: unknown[]) =>
    new Promise((resolve, reject) => {
      this.requests.push({ event, payload: args[0], resolve, reject });
    })) as unknown as Requester;

  connect() {
    this.connected = true;
    for (const listener of this.connectListeners) listener();
  }

  /** Like Socket.IO: listeners first, then pending acknowledgements are rejected. */
  disconnect() {
    this.connected = false;
    for (const listener of this.disconnectListeners) listener();
    for (const pending of this.requests.splice(0)) pending.reject(new Error('socket has been disconnected'));
  }

  push(room: PublicRoom) {
    for (const listener of this.stateListeners) listener(room);
  }

  /** Answers the oldest pending request for `event`. */
  async answer(event: EventName, reply: unknown) {
    const index = this.requests.findIndex((r) => r.event === event);
    if (index === -1) throw new Error(`No pending ${event} request`);
    const [pending] = this.requests.splice(index, 1);
    pending!.resolve(reply);
    await flush();
  }

  pending(event: EventName) {
    return this.requests.filter((r) => r.event === event);
  }

  private listen<T>(set: Set<T>, listener: T) {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }
}

class MemorySessions implements SessionStore {
  map = new Map<string, StoredSession>();
  get = (code: string) => this.map.get(code) ?? null;
  save = (code: string, session: StoredSession) => void this.map.set(code, session);
  forget = (code: string) => void this.map.delete(code);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const CODE = 'K7M2QX';
const ME = 'me-1';
const SESSION = { token: 'secret-token-0123456789', participantId: ME };
const JOIN_OK = { ok: true, code: CODE, participantId: ME, token: SESSION.token };

function snapshot(patch: Partial<PublicRoom> = {}): PublicRoom {
  return {
    code: CODE,
    phase: 'lobby',
    round: 1,
    hostId: ME,
    participants: [{ id: ME, name: 'Ayşe', connected: true, isVoter: false, hasVoted: false }],
    departedVoters: [],
    candidates: [],
    results: null,
    ...patch,
  };
}

async function setup({ stored = true, connected = true } = {}) {
  const transport = new FakeTransport();
  transport.connected = connected;
  const sessions = new MemorySessions();
  if (stored) sessions.save(CODE, SESSION);
  const connection = new RoomConnection(CODE, transport, sessions);
  connection.start();
  await flush();
  return { transport, sessions, connection };
}

/** Completes a rejoin: acknowledgement first, then the snapshot. */
async function rejoin(transport: FakeTransport, room = snapshot()) {
  await transport.answer('room:join', JOIN_OK);
  transport.push(room);
}

describe('RoomConnection', () => {
  it('rejoins with the stored token and becomes ready only after the ack and a snapshot', async () => {
    const { transport, connection } = await setup();

    expect(transport.pending('room:join')[0]!.payload).toEqual({ code: CODE, token: SESSION.token });
    expect(connection.getState()).toMatchObject({ view: { kind: 'loading' }, ready: false });

    await transport.answer('room:join', JOIN_OK);
    expect(connection.getState().ready).toBe(false); // acked, but no snapshot yet

    transport.push(snapshot());
    expect(connection.getState()).toMatchObject({ view: { kind: 'room', meId: ME }, ready: true });
  });

  it('also becomes ready when the snapshot arrives before the ack', async () => {
    const { transport, connection } = await setup();

    transport.push(snapshot());
    expect(connection.getState()).toMatchObject({ view: { kind: 'loading' }, ready: false });

    await transport.answer('room:join', JOIN_OK);
    expect(connection.getState()).toMatchObject({ view: { kind: 'room' }, ready: true });
  });

  it('refuses room actions before the rejoin completes, sending nothing', async () => {
    const { transport, connection } = await setup();
    await transport.answer('room:join', JOIN_OK); // snapshot still missing

    expect(await connection.act('voting:start')).toEqual({ ok: false, error: 'NOT_READY' });
    expect(transport.pending('voting:start')).toEqual([]);
  });

  it('blocks actions from the moment the connection drops until the new rejoin is complete', async () => {
    const { transport, connection } = await setup();
    await rejoin(transport);

    transport.disconnect();
    expect(connection.getState()).toMatchObject({ connected: false, ready: false, view: { kind: 'room' } });
    expect(await connection.act('voting:start')).toEqual({ ok: false, error: 'NOT_READY' });

    transport.connect();
    expect(transport.pending('room:join')).toHaveLength(1);
    expect(await connection.act('voting:start')).toEqual({ ok: false, error: 'NOT_READY' });

    await transport.answer('room:join', JOIN_OK);
    expect(await connection.act('voting:start')).toEqual({ ok: false, error: 'NOT_READY' }); // still no snapshot

    transport.push(snapshot({ phase: 'lobby', round: 2 }));
    expect(connection.getState()).toMatchObject({ ready: true, view: { room: { round: 2 } } });
    expect(transport.pending('voting:start')).toEqual([]);

    const started = connection.act('voting:start');
    await transport.answer('voting:start', { ok: true });
    expect(await started).toEqual({ ok: true });
  });

  it('reports an action interrupted by a disconnect as a connection error', async () => {
    const { transport, connection } = await setup();
    await rejoin(transport);

    const started = connection.act('voting:start');
    transport.disconnect();

    expect(await started).toEqual({ ok: false, error: 'CONNECTION' });
  });

  it('ignores a rejoin reply from a connection that has since dropped', async () => {
    const { transport, connection } = await setup();
    // Take the request out of the fake's list so the disconnect can't reject it:
    // it stands for an acknowledgement that still arrives late.
    const stale = transport.requests.splice(0)[0]!;

    transport.disconnect();
    transport.connect();
    stale.resolve(JOIN_OK);
    await flush();
    transport.push(snapshot());

    expect(connection.getState().ready).toBe(false);
    await transport.answer('room:join', JOIN_OK);
    expect(connection.getState().ready).toBe(true);
  });

  it('falls back to the invite screen when the token expired, and remembers why', async () => {
    const { transport, sessions, connection } = await setup();

    await transport.answer('room:join', { ok: false, error: 'SESSION_EXPIRED' });
    expect(sessions.get(CODE)).toBeNull();
    await transport.answer('room:peek', { ok: true, hostName: 'Ayşe', phase: 'lobby', participantCount: 2 });

    expect(connection.getState().view).toEqual({
      kind: 'invite',
      preview: { hostName: 'Ayşe', phase: 'lobby', participantCount: 2 },
      removed: true,
    });
  });

  it('shows the invite screen without a stored token, then enters on joining by name', async () => {
    const { transport, sessions, connection } = await setup({ stored: false });

    expect(transport.pending('room:join')).toEqual([]);
    await transport.answer('room:peek', { ok: true, hostName: 'Ayşe', phase: 'voting', participantCount: 3 });
    expect(connection.getState().view).toMatchObject({ kind: 'invite', removed: false });

    const joined = connection.joinWithName('Ali');
    expect(transport.pending('room:join')[0]!.payload).toEqual({ code: CODE, name: 'Ali' });
    await transport.answer('room:join', JOIN_OK);
    expect(await joined).toBeNull();
    expect(sessions.get(CODE)).toEqual(SESSION);

    transport.push(snapshot());
    expect(connection.getState()).toMatchObject({ view: { kind: 'room', meId: ME }, ready: true });
  });

  it('returns the join error and stays on the invite screen', async () => {
    const { transport, connection } = await setup({ stored: false });
    await transport.answer('room:peek', { ok: true, hostName: 'Ayşe', phase: 'lobby', participantCount: 1 });

    const joined = connection.joinWithName('Ayşe');
    await transport.answer('room:join', { ok: false, error: 'NAME_TAKEN' });

    expect(await joined).toBe('NAME_TAKEN');
    expect(connection.getState().view.kind).toBe('invite');
  });

  it('shows not-found and forgets the token when the room is gone', async () => {
    const { transport, sessions, connection } = await setup();
    await transport.answer('room:join', { ok: false, error: 'ROOM_NOT_FOUND' });

    expect(connection.getState().view).toEqual({ kind: 'not-found' });
    expect(sessions.get(CODE)).toBeNull();
  });

  it('shows not-found when an action finds the room expired', async () => {
    const { transport, connection } = await setup();
    await rejoin(transport);

    const added = connection.act('candidates:add', { movieId: 'matrix' });
    await transport.answer('candidates:add', { ok: false, error: 'ROOM_NOT_FOUND' });

    expect(await added).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(connection.getState().view).toEqual({ kind: 'not-found' });
  });

  it('waits for the first connection before doing anything', async () => {
    const { transport, connection } = await setup({ connected: false });
    expect(transport.requests).toEqual([]);
    expect(connection.getState()).toMatchObject({ connected: false, view: { kind: 'loading' } });

    transport.connect();
    expect(transport.pending('room:join')).toHaveLength(1);
  });

  it('stops listening when stopped', async () => {
    const { transport, connection } = await setup();
    connection.stop();

    await transport.answer('room:join', JOIN_OK);
    transport.push(snapshot());
    transport.disconnect();
    transport.connect();

    expect(connection.getState()).toMatchObject({ view: { kind: 'loading' }, ready: false });
    expect(transport.requests).toEqual([]);
  });

  it('forgets the session after leaving', async () => {
    const { transport, sessions, connection } = await setup();
    await rejoin(transport);

    const left = connection.leave();
    await transport.answer('room:leave', { ok: true });

    expect(await left).toEqual({ ok: true });
    expect(sessions.get(CODE)).toBeNull();
  });
});
