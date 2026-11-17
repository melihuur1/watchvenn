import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { findCatalogMovie } from '@shared/catalog';
import { LIMITS } from '@shared/constants';
import type { Movie } from '@shared/types';
import { MovieCard, MovieCardBack } from '../components/MovieCard';
import { Button } from '../components/ui/Button';
import { Icon, type IconName } from '../components/ui/Icon';
import { Logo, LogoMark } from '../components/ui/Logo';
import { TextInput } from '../components/ui/TextInput';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../lib/errors';
import { navigate } from '../lib/router';
import { getLastName, rememberName, sessionStore } from '../lib/session';
import { ConnectionError, request, whenConnected } from '../lib/socket';

/** A sleeping free-tier server can take a while to answer the first time. */
const CONNECT_TIMEOUT_MS = 45_000;

export function HomePage() {
  useDocumentTitle(null);
  const [name, setName] = useState(getLastName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Önce adını yaz; arkadaşların seni böyle görecek.');
      input.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await whenConnected(CONNECT_TIMEOUT_MS);
      const reply = await request('room:create', { name: clean });
      if (!reply.ok) {
        setError(errorMessage(reply.error));
        return;
      }
      rememberName(clean);
      sessionStore.save(reply.code, { token: reply.token, participantId: reply.participantId });
      navigate(`/r/${reply.code}`);
    } catch (caught) {
      if (!(caught instanceof ConnectionError)) throw caught;
      setError(errorMessage('CONNECTION'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col overflow-x-clip px-5 sm:px-8">
      <header className="flex h-16 items-center">
        <Logo />
      </header>

      <main className="grid flex-1 items-center gap-10 pt-6 pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-14">
        <section className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[13px] font-semibold text-amber-200 ring-1 ring-white/10">
            <Icon name="users" className="size-4" />
            Arkadaş grubunla film seçmenin en hızlı yolu
          </p>
          <h1 className="mt-5 text-[2.65rem] leading-[1.02] font-black tracking-tight text-balance sm:text-6xl lg:text-[4.1rem]">
            “Ne izlesek?” tartışmasına <span className="text-gradient">son.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-stone-400">
            Oda kur, linki paylaş, herkes oylasın. Kimsenin itiraz etmediği en iyi 3 film bir dakikada önünüzde.
          </p>

          <form onSubmit={createRoom} className="mt-8 max-w-md" noValidate>
            <label htmlFor="host-name" className="mb-2 block text-sm font-semibold text-stone-300">
              Adın
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <TextInput
                id="host-name"
                ref={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Ayşe"
                autoComplete="nickname"
                enterKeyHint="go"
                maxLength={LIMITS.nameMaxLength}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'host-error' : 'host-hint'}
              />
              <Button type="submit" size="lg" loading={pending} iconRight="arrow-right" className="sm:w-auto">
                {pending ? 'Oda kuruluyor…' : 'Oda oluştur'}
              </Button>
            </div>
            {error ? (
              <p id="host-error" role="alert" className="mt-3 text-sm font-medium text-rose-300">
                {error}
              </p>
            ) : (
              <p id="host-hint" className="mt-3 text-sm text-stone-500">
                Hesap yok, uygulama yok. Arkadaşların sadece linke tıklar.
              </p>
            )}
          </form>
        </section>

        <HeroCards />
      </main>

      <HowItWorks />

      <footer className="flex flex-col items-center gap-2 border-t border-white/[0.06] py-8 text-center text-sm text-stone-500">
        <LogoMark className="size-6 opacity-70" />
        Odalar geçicidir: hesap gerekmez, hiçbir şey kalıcı olarak saklanmaz.
      </footer>
    </div>
  );
}

type Sticker = { icon: IconName; label: string; className: string };
const VETO: Sticker = { icon: 'x', label: 'Veto', className: 'bg-rose-500 text-white' };
const NEUTRAL: Sticker = { icon: 'tilde', label: 'Fark etmez', className: 'bg-slate-200 text-ink-950' };
const YES: Sticker = { icon: 'check', label: 'Evet', className: 'bg-emerald-400 text-ink-950' };

const SIDE_CARDS = [
  { id: 'hababam-sinifi', sticker: VETO, place: 'left-0 top-[16%]', stickerPlace: '-top-3 -left-1', tilt: '-10deg', delay: '-2s' },
  { id: 'amelie', sticker: NEUTRAL, place: 'right-0 top-[20%]', stickerPlace: '-top-3 -right-1', tilt: '9deg', delay: '-5s' },
];

function VoteSticker({ sticker, className }: { sticker: Sticker; className: string }) {
  return (
    <span className={`absolute z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ${sticker.className} ${className}`}>
      <Icon name={sticker.icon} className="size-3.5" strokeWidth={3} />
      {sticker.label}
    </span>
  );
}

/** Decorative: a hand of cards mid-vote, over the brand's two glowing circles. Only the front card is read. */
function HeroCards() {
  const front = findCatalogMovie('interstellar') as Movie;
  return (
    <div aria-hidden="true" className="relative mx-auto h-[21rem] w-full max-w-[28rem] animate-fade-in select-none sm:h-[26rem]">
      <div className="absolute top-1/2 left-1/2 size-60 -translate-x-[78%] -translate-y-1/2 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 size-60 -translate-x-[22%] -translate-y-1/2 rounded-full bg-rose-500/25 blur-3xl" />
      {SIDE_CARDS.map((card) => (
        <div
          key={card.id}
          className={`absolute w-[9.5rem] animate-float sm:w-[12.5rem] ${card.place}`}
          style={{ '--tilt': card.tilt, animationDelay: card.delay } as CSSProperties}
        >
          <MovieCardBack movie={findCatalogMovie(card.id) as Movie} className="aspect-[3/4] rounded-[1.4rem] shadow-xl" />
          <VoteSticker sticker={card.sticker} className={card.stickerPlace} />
        </div>
      ))}
      <div className="absolute top-0 left-1/2 z-10 w-[11.5rem] -translate-x-1/2 animate-float sm:w-[14rem]" style={{ '--tilt': '-2deg' } as CSSProperties}>
        <MovieCard movie={front} size="hero" className="aspect-[3/4]" />
        <VoteSticker sticker={YES} className="-top-3 right-4" />
      </div>
      <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink-900/90 px-4 py-3 whitespace-nowrap shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <span className="grid size-11 place-items-center rounded-full bg-[conic-gradient(var(--color-amber-300)_0_88%,rgb(255_255_255/0.1)_88%_100%)]">
          <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-xs font-black">88</span>
        </span>
        <span>
          <span className="block text-sm font-bold">Güçlü uyum</span>
          <span className="block text-xs text-stone-400">3 Evet, 1 Fark etmez · veto yok</span>
        </span>
      </div>
    </div>
  );
}

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'link',
    title: 'Oda kur, linki paylaş',
    text: 'Adını yaz, odayı oluştur ve linki gruba gönder. Kimsenin hesap açmasına gerek yok.',
  },
  {
    icon: 'check',
    title: 'Herkes oylasın',
    text: 'Her film için Evet, Fark etmez ya da Veto. Oylar gizli kalır; kimse kimin veto ettiğini görmez.',
  },
  {
    icon: 'sparkle',
    title: 'Ortak paydayı görün',
    text: "Kimsenin veto etmediği filmler arasından en sevilen 3'ü, nedenleriyle birlikte.",
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="pb-16">
      <h2 id="how-title" className="text-center text-sm font-bold tracking-[0.2em] text-stone-500 uppercase">
        Nasıl çalışır?
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/[0.07]">
            <span className="relative inline-flex h-10 w-16 items-center">
              <span className="absolute left-0 size-10 rounded-full bg-amber-400/20 ring-1 ring-amber-300/30" />
              <span className="absolute left-6 size-10 rounded-full bg-rose-500/20 ring-1 ring-rose-400/30" />
              <Icon name={step.icon} className="relative left-[1.45rem] size-5 text-amber-100" />
            </span>
            <h3 className="mt-4 text-lg font-bold">
              <span className="text-stone-500 tabular-nums">{i + 1}. </span>
              {step.title}
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-stone-400">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
