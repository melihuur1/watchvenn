// One room's connection lifecycle, outside React so it can be tested with a fake transport.
//
// On every (re)connect it rejoins with the stored token, or falls back to the invite screen.
// Room actions are allowed only while `ready`: connected, rejoined on *this* connection, and
// holding a snapshot the server sent after that rejoin. A disconnect clears `ready` at once,
// and every reply from an older connection is ignored, so a stale or queued action can never
// reach the server before the rejoin does.
import type { AckResponse, RoomPreview } from '@shared/events';
import type { PublicRoom } from '@shared/types';
import type { ClientError } from './errors';
import type { SessionStore } from './session';
import type { EventName, Payload, Transport } from './socket';

export type RoomView =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  /** No identity in this room yet. `removed`: our old token stopped working (e.g. dropped from the lobby). */
  | { kind: 'invite'; preview: RoomPreview; removed: boolean }
  /** `room` may be a little stale while reconnecting; `ready` says whether it's live. */
  | { kind: 'room'; room: PublicRoom; meId: string };

export interface RoomConnectionState {
  view: RoomView;
  connected: boolean;
  /** Connected, rejoined on this connection and holding a snapshot sent after the rejoin. */
  ready: boolean;
}

export type RoomAction = Exclude<EventName, 'room:create' | 'room:peek' | 'room:join'>;
export type ActionResult = { ok: true } | { ok: false; error: ClientError };

const RETRY_MS = 2000;

export class RoomConnection {
  private readonly code: string;
  private readonly transport: Transport;
  private readonly sessions: SessionStore;
  private state: RoomConnectionState;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void)[] = [];

  /** Bumped on every connect, disconnect and stop. A reply from an older generation is stale. */
  private generation = 0;
  private meId: string | null = null;
  private latest: PublicRoom | null = null;
  private joinAcked = false;
  private freshSnapshot = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(code: string, transport: Transport, sessions: SessionStore) {
    this.code = code;
    this.transport = transport;
    this.sessions = sessions;
    this.state = { view: { kind: 'loading' }, connected: transport.isConnected(), ready: false };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): RoomConnectionState => this.state;

  start(): void {
    this.unsubscribe = [
      this.transport.onConnect(this.handleConnect),
      this.transport.onDisconnect(this.handleDisconnect),
      this.transport.onState(this.handleState),
    ];
    this.update({ connected: this.transport.isConnected() });
    if (this.transport.isConnected()) void this.enter();
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe = [];
    this.generation += 1;
    clearTimeout(this.retryTimer);
  }

  /** Joins as a new participant from the invite screen. Resolves to an error, or null on success. */
  async joinWithName(name: string): Promise<ClientError | null> {
    if (!this.transport.isConnected()) return 'CONNECTION';
    const generation = this.generation;
    try {
      const reply = await this.transport.request('room:join', { code: this.code, name });
      if (!reply.ok) {
        if (reply.error === 'ROOM_NOT_FOUND' && generation === this.generation) this.close();
        return reply.error;
      }
      // Keep the token even if we were stopped meanwhile: the identity exists on the server.
      this.sessions.save(this.code, { token: reply.token, participantId: reply.participantId });
      if (generation !== this.generation) return null;
      this.meId = reply.participantId;
      this.joinAcked = true;
      this.settle();
      return null;
    } catch {
      return 'CONNECTION';
    }
  }

  /** Sends a room action, but only once the rejoin is complete. Otherwise nothing is sent. */
  async act<E extends RoomAction>(event: E, ...args: Payload<E>): Promise<ActionResult> {
    if (!this.state.ready) return { ok: false, error: 'NOT_READY' };
    const generation = this.generation;
    try {
      const reply = (await this.transport.request(event, ...args)) as AckResponse;
      if (!reply.ok && generation === this.generation) {
        if (reply.error === 'ROOM_NOT_FOUND') this.close();
        else if (reply.error === 'SESSION_EXPIRED') void this.enter();
      }
      return reply.ok ? { ok: true } : reply;
    } catch {
      return { ok: false, error: 'CONNECTION' };
    }
  }

  async leave(): Promise<ActionResult> {
    const result = await this.act('room:leave');
    if (result.ok) {
      this.sessions.forget(this.code);
      this.meId = null;
    }
    return result;
  }

  private readonly handleConnect = () => {
    this.update({ connected: true });
    void this.enter();
  };

  private readonly handleDisconnect = () => {
    this.generation += 1;
    this.joinAcked = false;
    this.freshSnapshot = false;
    clearTimeout(this.retryTimer);
    this.update({ connected: false, ready: false });
  };

  private readonly handleState = (room: PublicRoom) => {
    if (room.code !== this.code) return;
    this.latest = room;
    this.freshSnapshot = true;
    this.settle();
  };

  /** Runs on every (re)connect: rejoin with the stored token, or show the invite screen. */
  private async enter(): Promise<void> {
    const generation = ++this.generation;
    const isCurrent = () => generation === this.generation;
    this.joinAcked = false;
    this.freshSnapshot = false;
    clearTimeout(this.retryTimer);
    this.update({ ready: false });

    try {
      let removed = false;
      const stored = this.sessions.get(this.code);
      if (stored) {
        const reply = await this.transport.request('room:join', { code: this.code, token: stored.token });
        if (!isCurrent()) return;
        if (reply.ok) {
          this.meId = reply.participantId;
          this.joinAcked = true;
          this.settle();
          return;
        }
        if (reply.error === 'ROOM_NOT_FOUND') return this.close();
        // The token no longer works here, e.g. we were removed from the lobby while offline.
        this.sessions.forget(this.code);
        this.meId = null;
        this.latest = null;
        removed = reply.error === 'SESSION_EXPIRED';
      }

      const preview = await this.transport.request('room:peek', { code: this.code });
      if (!isCurrent()) return;
      if (!preview.ok) return this.close();
      const { hostName, phase, participantCount } = preview;
      this.update({ view: { kind: 'invite', preview: { hostName, phase, participantCount }, removed }, ready: false });
    } catch {
      // No acknowledgement. A reconnect calls enter() again; if we're still connected, retry soon.
      if (isCurrent() && this.transport.isConnected()) {
        this.retryTimer = setTimeout(() => {
          if (isCurrent()) void this.enter();
        }, RETRY_MS);
      }
    }
  }

  /** Shows the room once we know who we are; marks it ready once ack and snapshot both arrived. */
  private settle(): void {
    if (!this.meId || !this.latest) return;
    this.update({
      view: { kind: 'room', room: this.latest, meId: this.meId },
      ready: this.joinAcked && this.freshSnapshot && this.transport.isConnected(),
    });
  }

  /** The room is gone for good (expired, closed or never existed). */
  private close(): void {
    this.sessions.forget(this.code);
    this.meId = null;
    this.latest = null;
    this.update({ view: { kind: 'not-found' }, ready: false });
  }

  private update(patch: Partial<RoomConnectionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
