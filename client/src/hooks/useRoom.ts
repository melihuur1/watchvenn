import { useEffect, useState, useSyncExternalStore } from 'react';
import { RoomConnection } from '../lib/roomConnection';
import { sessionStore } from '../lib/session';
import { transport } from '../lib/socket';

/**
 * The live room behind /r/:code: join or rejoin, the latest server snapshot, and the
 * actions. The server snapshot *is* the store; see RoomConnection for the lifecycle.
 */
export function useRoom(code: string) {
  const [connection] = useState(() => new RoomConnection(code, transport, sessionStore));

  useEffect(() => {
    connection.start();
    return () => connection.stop();
  }, [connection]);

  const state = useSyncExternalStore(connection.subscribe, connection.getState);
  return { ...state, connection };
}
