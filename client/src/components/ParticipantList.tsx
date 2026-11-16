import type { PublicRoom } from '@shared/types';
import { Avatar } from './ui/Avatar';
import { Icon } from './ui/Icon';

export function ParticipantList({ room, meId }: { room: PublicRoom; meId: string }) {
  return (
    <ul className="space-y-0.5" aria-label="Odadakiler">
      {room.participants.map((p) => {
        const isHost = p.id === room.hostId;
        const status = [isHost && 'Ev sahibi', p.connected ? 'çevrimiçi' : 'bağlantı koptu'].filter(Boolean).join(' · ');
        return (
          <li key={p.id} className="flex animate-fade-in items-center gap-3 rounded-2xl px-2 py-2">
            <Avatar name={p.name} online={p.connected} size="sm" />
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-1.5 font-semibold ${p.connected ? 'text-stone-100' : 'text-stone-400'}`}>
                <span className="truncate">{p.name}</span>
                {p.id === meId && (
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[11px] font-bold text-stone-300">sen</span>
                )}
              </p>
              <p className="text-xs text-stone-500 first-letter:uppercase">{status}</p>
            </div>
            {isHost && <Icon name="crown" className="size-5 shrink-0 text-amber-300" />}
          </li>
        );
      })}
    </ul>
  );
}
