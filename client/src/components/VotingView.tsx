import type { RoomViewProps } from '../hooks/useRoomActions';
import { voterRoster, type RosterVoter } from '../lib/roster';
import { HostVotingControls } from './HostVotingControls';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';
import { Panel } from './ui/Panel';
import { VoteDeck } from './VoteDeck';

/** Voters who haven't submitted see the deck; everyone else watches the round fill up. */
export function VotingView(props: RoomViewProps) {
  const me = props.room.participants.find((p) => p.id === props.meId);
  if (me?.isVoter && !me.hasVoted) return <VoteDeck key={props.room.round} {...props} />;
  return <WaitingPanel {...props} />;
}

function WaitingPanel({ room, meId, isHost, ready, run }: RoomViewProps) {
  const me = room.participants.find((p) => p.id === meId);
  const spectating = !me?.isVoter;
  const { voters, spectators, ballotCount, pendingCount } = voterRoster(room);
  const percent = voters.length === 0 ? 0 : (ballotCount / voters.length) * 100;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex animate-fade-up flex-col items-center pt-2 text-center">
        {spectating ? (
          <span className="grid size-16 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <Icon name="eye" className="size-8 text-amber-200" />
          </span>
        ) : (
          <span className="grid size-16 animate-pop place-items-center rounded-full bg-emerald-400 text-ink-950 shadow-[0_0_40px_-6px_rgb(52_211_153/0.7)]">
            <Icon name="check" className="size-9" strokeWidth={3} />
          </span>
        )}
        <h1 className="mt-4 text-3xl font-black tracking-tight">{spectating ? 'Bu turu izliyorsun' : 'Oyun alındı'}</h1>
        <p className="mt-2 max-w-md text-stone-400">
          {spectating
            ? 'Oylama başladığında listede değildin. Sonuçları burada göreceksin; sonraki turda sen de oy verirsin.'
            : 'Diğerlerini bekliyoruz. Herkes oyunu verince sonuçlar kendiliğinden açılacak.'}
        </p>
      </div>

      <Panel
        title="Oy durumu"
        action={
          <span className="text-sm font-bold text-stone-200 tabular-nums">
            {ballotCount}/{voters.length} <span className="font-normal text-stone-500">oy verdi</span>
          </span>
        }
      >
        <div
          className="h-2 overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-label="Oy veren kişi sayısı"
          aria-valuemin={0}
          aria-valuemax={voters.length}
          aria-valuenow={ballotCount}
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-300 to-emerald-400 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <ul className="mt-4 space-y-1" aria-live="polite">
          {voters.map((voter) => (
            <VoterRow key={voter.id} voter={voter} isMe={voter.id === meId} isHost={voter.id === room.hostId} />
          ))}
        </ul>
        {spectators.length > 0 && (
          <p className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-sm text-stone-500">
            <Icon name="eye" className="size-4 shrink-0" />
            İzleyenler: {spectators.map((s) => (s.id === meId ? `${s.name} (sen)` : s.name)).join(', ')}
          </p>
        )}
      </Panel>

      {isHost ? (
        <HostVotingControls room={room} ready={ready} run={run} />
      ) : (
        pendingCount > 0 && (
          <p className="flex gap-2.5 px-1 text-sm text-stone-500">
            <Icon name="info" className="mt-px size-4 shrink-0" />
            Ev sahibi herkes bitirmeden oylamayı sonlandırabilir; o zaman yalnızca gönderilen oylar sayılır.
          </p>
        )
      )}
    </div>
  );
}

function VoterRow({ voter, isMe, isHost }: { voter: RosterVoter; isMe: boolean; isHost: boolean }) {
  let status: { text: string; className: string; icon?: 'check' | 'logout' | 'wifi-off' };
  if (voter.departed) {
    status = voter.hasVoted
      ? { text: 'Ayrıldı · oyu sayılacak', className: 'text-stone-400', icon: 'logout' }
      : { text: 'Ayrıldı · oy vermedi', className: 'text-stone-500', icon: 'logout' };
  } else if (voter.hasVoted) {
    status = { text: 'Oy verdi', className: 'text-emerald-300', icon: 'check' };
  } else if (!voter.connected) {
    status = { text: 'Bağlantı koptu · bekleniyor', className: 'text-stone-500', icon: 'wifi-off' };
  } else {
    status = { text: 'Oy veriyor…', className: 'text-amber-200' };
  }

  return (
    <li className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${voter.departed ? 'opacity-60' : ''}`}>
      <Avatar name={voter.name} size="sm" online={voter.departed ? undefined : voter.connected} />
      <p className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold">
        <span className="truncate">{voter.name}</span>
        {isMe && <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[11px] font-bold text-stone-300">sen</span>}
        {isHost && <Icon name="crown" className="size-4 shrink-0 text-amber-300" />}
      </p>
      <span className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold ${status.className}`}>
        {status.icon ? (
          <Icon name={status.icon} className="size-4" strokeWidth={status.icon === 'check' ? 3 : 2} />
        ) : (
          <span className="size-2 animate-breathe rounded-full bg-amber-300" aria-hidden="true" />
        )}
        {status.text}
      </span>
    </li>
  );
}
