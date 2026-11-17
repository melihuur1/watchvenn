import { useEffect, useRef, useState } from 'react';
import { parseRoomCode } from '@shared/text';
import type { Phase, PublicRoom } from '@shared/types';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { LobbyView } from '../components/LobbyView';
import { ResultsView } from '../components/ResultsView';
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

  // Remember the phase from the previous render: results reached live from voting get the
  // "calculating" moment; results reached by refresh or link don't.
  const [shownPhase, setShownPhase] = useState(room.phase);
  const [reveal, setReveal] = useState(false);
  if (shownPhase !== room.phase) {
    setShownPhase(room.phase);
    setReveal(shownPhase === 'voting' && room.phase === 'results');
  }

  // A new phase is a new screen: start it from the top, and if the control that had focus
  // disappeared with the old screen, hand focus to the new one instead of the page body.
  const main = useRef<HTMLElement>(null);
  const phaseOnMount = useRef(room.phase);
  useEffect(() => {
    if (phaseOnMount.current === room.phase) return;
    phaseOnMount.current = room.phase;
    window.scrollTo(0, 0);
    if (!document.activeElement || document.activeElement === document.body) main.current?.focus({ preventScroll: true });
  }, [room.phase]);

  return (
    <div className="flex min-h-dvh flex-col">
      <RoomHeader room={room} meId={meId} ready={ready} connection={connection} />
      <main ref={main} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 outline-none sm:px-6">
        {room.phase === 'lobby' && <LobbyView {...props} />}
        {room.phase === 'voting' && <VotingView {...props} />}
        {room.phase === 'results' && <ResultsView key={room.round} {...props} reveal={reveal} />}
      </main>
      <RoomNotifier room={room} meId={meId} />
    </div>
  );
}
