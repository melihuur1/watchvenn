import { useEffect } from 'react';
import { parseRoomCode } from '@shared/text';
import type { Phase, PublicRoom } from '@shared/types';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { LobbyView } from '../components/LobbyView';
import { ParticipantList } from '../components/ParticipantList';
import { RoomHeader } from '../components/RoomHeader';
import { RoomNotifier } from '../components/RoomNotifier';
import { VotingView } from '../components/VotingView';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRoom } from '../hooks/useRoom';
import { useRoomActions, type RoomViewProps } from '../hooks/useRoomActions';
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

const PHASE_TITLES: Record<Phase, string> = { lobby: 'Lobi', voting: 'Oylama', results: 'Sonuçlar' };

function RoomShell({ room, meId, ready, connection }: { room: PublicRoom; meId: string; ready: boolean; connection: RoomConnection }) {
  const run = useRoomActions(connection);
  useDocumentTitle(PHASE_TITLES[room.phase]);
  const props: RoomViewProps = { room, meId, isHost: room.hostId === meId, ready, run, connection };

  return (
    <div className="flex min-h-dvh flex-col">
      <RoomHeader room={room} meId={meId} ready={ready} connection={connection} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 sm:px-6">
        {room.phase === 'lobby' && <LobbyView {...props} />}
        {room.phase === 'voting' && <VotingView {...props} />}
        {room.phase === 'results' && <PhasePlaceholder {...props} />}
      </main>
      <RoomNotifier room={room} meId={meId} />
    </div>
  );
}

/** Voting and results views follow in the next phases. */
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
