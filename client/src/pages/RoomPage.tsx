import { useEffect } from 'react';
import { parseRoomCode } from '@shared/text';
import type { Phase, PublicRoom } from '@shared/types';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ParticipantList } from '../components/ParticipantList';
import { RoomHeader } from '../components/RoomHeader';
import { RoomNotifier } from '../components/RoomNotifier';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRoom } from '../hooks/useRoom';
import { useRoomActions, type RunAction } from '../hooks/useRoomActions';
import type { RoomConnection } from '../lib/roomConnection';
import { navigate } from '../lib/router';
import { InvitePage } from './InvitePage';
import { RoomNotFound } from './RoomNotFound';
import { RoomSkeleton } from './RoomSkeleton';

/** /r/:code. Codes are case-insensitive: the URL is rewritten to the canonical form. */
export function RoomPage({ rawCode }: { rawCode: string }) {
  const code = parseRoomCode(rawCode);
  useEffect(() => {
    if (code && code !== rawCode) navigate(`/r/${code}`, { replace: true });
  }, [code, rawCode]);

  if (!code) return <RoomNotFound />;
  return <RoomScreen key={code} code={code} />;
}

function RoomScreen({ code }: { code: string }) {
  const { view, connected, ready, connection } = useRoom(code);
  useDocumentTitle(view.kind === 'invite' ? 'Davet' : null);

  return (
    <>
      <ConnectionBanner show={!connected || (view.kind === 'room' && !ready)} />
      {view.kind === 'loading' && <RoomSkeleton />}
      {view.kind === 'not-found' && <RoomNotFound />}
      {view.kind === 'invite' && (
        <InvitePage
          preview={view.preview}
          removed={view.removed}
          connected={connected}
          onJoin={(name) => connection.joinWithName(name)}
        />
      )}
      {view.kind === 'room' && <RoomShell room={view.room} meId={view.meId} ready={ready} connection={connection} />}
    </>
  );
}

/** What every phase view gets. `ready` is false while reconnecting: controls must be disabled. */
export interface RoomViewProps {
  room: PublicRoom;
  meId: string;
  isHost: boolean;
  ready: boolean;
  run: RunAction;
}

const PHASE_TITLES: Record<Phase, string> = { lobby: 'Lobi', voting: 'Oylama', results: 'Sonuçlar' };

function RoomShell({ room, meId, ready, connection }: { room: PublicRoom; meId: string; ready: boolean; connection: RoomConnection }) {
  const run = useRoomActions(connection);
  useDocumentTitle(PHASE_TITLES[room.phase]);
  const props: RoomViewProps = { room, meId, isHost: room.hostId === meId, ready, run };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
      <RoomHeader room={room} meId={meId} ready={ready} connection={connection} />
      <main className="flex-1 pt-4 pb-32 lg:pb-16">
        <PhasePlaceholder {...props} />
      </main>
      <RoomNotifier room={room} meId={meId} />
    </div>
  );
}

/** Phase 4: the live participant list; the lobby, voting and results views follow. */
function PhasePlaceholder({ room, meId }: RoomViewProps) {
  return (
    <section className="mx-auto max-w-md rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
      <h2 className="text-sm font-bold tracking-wide text-stone-400 uppercase">Odadakiler · {room.participants.length}</h2>
      <div className="mt-3">
        <ParticipantList room={room} meId={meId} />
      </div>
    </section>
  );
}
