import { useState, type FormEvent } from 'react';
import { LIMITS } from '@shared/constants';
import type { RoomPreview } from '@shared/events';
import { CenteredPage } from '../components/CenteredPage';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { TextInput } from '../components/ui/TextInput';
import { errorMessage, type ClientError } from '../lib/errors';
import { followLink } from '../lib/router';
import { getLastName, rememberName } from '../lib/session';

const PHASE_NOTES = {
  lobby: null,
  voting: 'Oylama şu an sürüyor. Bu turu izleyici olarak takip edersin; sonraki turda sen de oy verirsin.',
  results: 'Bu turun sonuçları açıklandı. Katılıp sonuçları görebilir, sonraki turda oy verebilirsin.',
} as const;

/** The landing page of an invite link: who's calling, and one field to join. */
export function InvitePage({
  preview,
  removed,
  connected,
  onJoin,
}: {
  preview: RoomPreview;
  removed: boolean;
  connected: boolean;
  onJoin: (name: string) => Promise<ClientError | null>;
}) {
  const [name, setName] = useState(getLastName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = preview.participantCount >= LIMITS.maxParticipants;
  const note = PHASE_NOTES[preview.phase];

  async function join(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Önce adını yaz.');
      return;
    }
    setPending(true);
    setError(null);
    const failure = await onJoin(clean);
    setPending(false);
    if (failure) setError(errorMessage(failure));
    else rememberName(clean);
  }

  return (
    <CenteredPage>
      <div className="w-full max-w-md animate-fade-up rounded-[2rem] bg-white/[0.035] p-6 ring-1 ring-white/[0.08] backdrop-blur sm:p-8">
        <div className="flex items-center gap-3">
          <Avatar name={preview.hostName} size="lg" />
          <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-400">
            <Icon name="users" className="size-4" />
            Odada {preview.participantCount} kişi var
          </p>
        </div>
        <h1 className="mt-5 text-[1.75rem] leading-tight font-black tracking-tight text-balance">
          {preview.hostName} seni film seçmeye çağırıyor
        </h1>
        <p className="mt-2 text-stone-400">
          Filmleri birlikte oylayacaksınız; herkesin kabul ettiği en iyi 3 film çıkacak. Hesap gerekmez.
        </p>

        {removed && (
          <p className="mt-5 flex gap-2.5 rounded-2xl bg-amber-300/10 p-3.5 text-sm text-amber-100 ring-1 ring-amber-300/20">
            <Icon name="wifi-off" className="mt-px size-[18px] shrink-0" />
            Bağlantın bir süre koptuğu için odadan çıkarıldın. Adını yazıp tekrar katılabilirsin.
          </p>
        )}
        {note && (
          <p className="mt-5 flex gap-2.5 rounded-2xl bg-white/[0.04] p-3.5 text-sm text-stone-300 ring-1 ring-white/10">
            <Icon name="eye" className="mt-px size-[18px] shrink-0 text-amber-200" />
            {note}
          </p>
        )}

        {full ? (
          <p role="alert" className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-200 ring-1 ring-rose-400/20">
            Bu oda dolu: en fazla {LIMITS.maxParticipants} kişi olabilir.
          </p>
        ) : (
          <form onSubmit={join} className="mt-6" noValidate>
            <label htmlFor="guest-name" className="mb-2 block text-sm font-semibold text-stone-300">
              Adın
            </label>
            <TextInput
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ali"
              autoComplete="nickname"
              enterKeyHint="go"
              maxLength={LIMITS.nameMaxLength}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'guest-error' : undefined}
            />
            {error && (
              <p id="guest-error" role="alert" className="mt-2.5 text-sm font-medium text-rose-300">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={pending} disabled={!connected} iconRight="arrow-right" className="mt-4 w-full">
              {preview.phase === 'lobby' ? 'Katıl' : 'İzleyici olarak katıl'}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-sm text-stone-500">
        Kendi odanı mı kurmak istiyorsun?{' '}
        <a href="/" onClick={followLink} className="font-semibold text-stone-300 underline-offset-4 hover:underline">
          Yeni oda oluştur
        </a>
      </p>
    </CenteredPage>
  );
}
