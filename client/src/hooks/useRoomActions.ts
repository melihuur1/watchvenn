import { useCallback } from 'react';
import { useToast } from '../components/ui/Toaster';
import { errorMessage } from '../lib/errors';
import type { RoomAction, RoomConnection } from '../lib/roomConnection';
import type { Payload } from '../lib/socket';

/** Runs a room action and shows any error as a toast. Resolves to whether it succeeded. */
export type RunAction = <E extends RoomAction>(event: E, ...args: Payload<E>) => Promise<boolean>;

export function useRoomActions(connection: RoomConnection): RunAction {
  const toast = useToast();
  return useCallback<RunAction>(
    async (event, ...args) => {
      const result = await connection.act(event, ...args);
      if (!result.ok) toast(errorMessage(result.error), 'error');
      return result.ok;
    },
    [connection, toast],
  );
}
