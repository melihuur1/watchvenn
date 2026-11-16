// The one Socket.IO connection, typed with the shared event maps, plus a request helper
// that turns acknowledgements into promises. Room actions never go through a socket
// that isn't connected: nothing is ever queued while offline and replayed later.
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/events';
import type { PublicRoom } from '@shared/types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type EventName = keyof ClientToServerEvents;
type Params<E extends EventName> = Parameters<ClientToServerEvents[E]>;
/** The arguments an event takes before its acknowledgement: `[payload]` or nothing. */
export type Payload<E extends EventName> = Params<E> extends [infer P, unknown] ? [payload: P] : [];
/** What the server acknowledges an event with. */
export type Reply<E extends EventName> = Params<E> extends [...unknown[], (response: infer R) => void] ? R : never;
export type Requester = <E extends EventName>(event: E, ...args: Payload<E>) => Promise<Reply<E>>;

/** The connection as RoomConnection sees it, so it can be tested with a fake. */
export interface Transport {
  isConnected(): boolean;
  onConnect(listener: () => void): () => void;
  onDisconnect(listener: () => void): () => void;
  onState(listener: (room: PublicRoom) => void): () => void;
  request: Requester;
}

const ACK_TIMEOUT_MS = 8000;

/** Thrown when a request can't be sent or no acknowledgement arrives. */
export class ConnectionError extends Error {
  constructor(message = 'connection unavailable') {
    super(message);
    this.name = 'ConnectionError';
  }
}

export const socket: AppSocket = io({ reconnectionDelay: 400, reconnectionDelayMax: 3000 });

// Socket.IO replays its send buffer on reconnect *before* the 'connect' event, so anything
// queued while offline would reach the server ahead of our rejoin. Drop it instead. Clearing
// it here also makes Socket.IO reject the pending acknowledgements right away.
socket.on('disconnect', () => {
  socket.sendBuffer.length = 0;
});

export async function request<E extends EventName>(event: E, ...args: Payload<E>): Promise<Reply<E>> {
  if (!socket.connected) throw new ConnectionError('offline');
  const timed = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
    emitWithAck(event: string, ...args: unknown[]): Promise<unknown>;
  };
  try {
    return (await timed.emitWithAck(event, ...args)) as Reply<E>;
  } catch (error) {
    throw new ConnectionError(error instanceof Error ? error.message : 'no acknowledgement');
  }
}

/** Resolves once connected (immediately if already), or rejects after `timeoutMs`. */
export function whenConnected(timeoutMs: number): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new ConnectionError('connect timeout'));
    }, timeoutMs);
    socket.once('connect', onConnect);
  });
}

export const transport: Transport = {
  isConnected: () => socket.connected,
  onConnect(listener) {
    socket.on('connect', listener);
    return () => socket.off('connect', listener);
  },
  onDisconnect(listener) {
    socket.on('disconnect', listener);
    return () => socket.off('disconnect', listener);
  },
  onState(listener) {
    socket.on('room:state', listener);
    return () => socket.off('room:state', listener);
  },
  request,
};
