import { useState, type FormEvent } from 'react';
import { CATALOG, GENRE_LABELS, GENRES } from '@shared/catalog';
import { LIMITS } from '@shared/constants';
import type { Genre, Movie, PublicRoom } from '@shared/types';
import type { RunAction } from '../hooks/useRoomActions';
import { searchKey } from '../lib/format';
import { MovieCard } from './MovieCard';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { Panel } from './ui/Panel';
import { Spinner } from './ui/Spinner';
import { TextInput } from './ui/TextInput';
import { useToast } from './ui/Toaster';

const QUICK_PICK = 6;
const INDEX = CATALOG.map((movie) => ({ movie, key: searchKey(`${movie.title} ${movie.originalTitle}`) }));

/** The host's lobby: what's selected so far, and the catalog to pick from. */
export function CatalogPicker({ room, ready, run }: { room: PublicRoom; ready: boolean; run: RunAction }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<Genre | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [quickPicking, setQuickPicking] = useState(false);

  const count = room.candidates.length;
  const full = count >= LIMITS.maxCandidates;
  const selected = new Set(room.candidates.map((m) => m.id));
  const words = searchKey(query).split(' ').filter(Boolean);
  const results = INDEX.filter(
    ({ movie, key }) => (!genre || movie.genres.includes(genre)) && words.every((word) => key.includes(word)),
  ).map((entry) => entry.movie);

  async function track(id: string, action: () => Promise<boolean>): Promise<boolean> {
    setBusy((current) => new Set(current).add(id));
    try {
      return await action();
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function toggle(movie: Movie) {
    if (busy.has(movie.id)) return;
    const event = selected.has(movie.id) ? 'candidates:remove' : 'candidates:add';
    void track(movie.id, () => run(event, { movieId: movie.id }));
  }

  /** Tops the list up to six at random, from the genre filter if one is on. */
  async function quickPick() {
    const pool = CATALOG.filter((m) => !selected.has(m.id) && (!genre || m.genres.includes(genre)));
    const picks = shuffle(pool).slice(0, QUICK_PICK - count);
    if (picks.length === 0) {
      toast('Bu türde eklenecek film kalmadı.', 'info');
      return;
    }
    setQuickPicking(true);
    for (const movie of picks) {
      if (!(await run('candidates:add', { movieId: movie.id }))) break;
    }
    setQuickPicking(false);
  }

  async function addCustom(title: string): Promise<boolean> {
    return track(`custom:${title}`, () => run('candidates:add', { customTitle: title }));
  }

  return (
    <>
      <Panel
        title={
          <>
            Seçilen filmler <span className="ml-1 text-stone-200 tabular-nums">{count}/{LIMITS.maxCandidates}</span>
          </>
        }
        action={
          count < QUICK_PICK && (
            <Button variant="secondary" size="sm" icon="shuffle" loading={quickPicking} disabled={!ready} onClick={quickPick}>
              {count === 0 ? `Rastgele ${QUICK_PICK} seç` : `${QUICK_PICK}'ya tamamla`}
            </Button>
          )
        }
      >
        {count === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center">
            <Icon name="film" className="size-7 text-stone-500" />
            <p className="mt-2 font-semibold text-stone-300">Henüz film seçmedin</p>
            <p className="mt-1 text-sm text-stone-500">Aşağıdaki katalogdan seç ya da tek dokunuşla rastgele 6 film ekle.</p>
          </div>
        ) : (
          <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pt-1 pb-2 scrollbar-none" aria-label="Seçilen filmler">
            {room.candidates.map((movie) => (
              <li key={movie.id} className="relative w-32 shrink-0 animate-card-in snap-start">
                <MovieCard movie={movie} size="tile" className="aspect-[3/4]" />
                <button
                  type="button"
                  onClick={() => toggle(movie)}
                  disabled={!ready || busy.has(movie.id)}
                  aria-label={`${movie.title} filmini listeden çıkar`}
                  className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
                >
                  {busy.has(movie.id) ? <Spinner className="size-3.5" /> : <Icon name="x" className="size-3.5" strokeWidth={2.75} />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-label="Seçilen film sayısı"
          aria-valuemin={0}
          aria-valuemax={LIMITS.maxCandidates}
          aria-valuenow={count}
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-300 to-rose-500 transition-[width] duration-500"
            style={{ width: `${(count / LIMITS.maxCandidates) * 100}%` }}
          />
        </div>
        {full && <p className="mt-2 text-sm text-amber-200">Liste dolu. Yeni film eklemek için önce birini çıkar.</p>}
      </Panel>

      <Panel title="Katalog">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Film ara: Matrix, Hababam…"
            aria-label="Katalogda film ara"
            className="pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Aramayı temizle"
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:bg-white/10 hover:text-stone-100"
            >
              <Icon name="x" className="size-4" />
            </button>
          )}
        </div>

        <div role="group" aria-label="Türe göre filtrele" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
          <GenreChip active={genre === null} onClick={() => setGenre(null)}>
            Tümü
          </GenreChip>
          {GENRES.map((g) => (
            <GenreChip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
              {GENRE_LABELS[g]}
            </GenreChip>
          ))}
        </div>

        <p className="mt-4 mb-3 text-xs font-semibold text-stone-500" aria-live="polite">
          {results.length} film
        </p>
        {results.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {results.map((movie) => (
              <li key={movie.id}>
                <CatalogTile
                  movie={movie}
                  selected={selected.has(movie.id)}
                  busy={busy.has(movie.id)}
                  disabled={!ready || (full && !selected.has(movie.id))}
                  onToggle={() => toggle(movie)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] px-4 py-6 text-center ring-1 ring-white/[0.06]">
            <p className="font-semibold text-stone-300">“{query.trim() || GENRE_LABELS[genre!]}” için katalogda film yok.</p>
            {query.trim() && (
              <Button
                variant="secondary"
                icon="plus"
                className="mt-3"
                disabled={!ready || full}
                onClick={async () => {
                  if (await addCustom(query.trim())) setQuery('');
                }}
              >
                “{query.trim()}” filmini ekle
              </Button>
            )}
          </div>
        )}

        <CustomTitleForm disabled={!ready || full} onAdd={addCustom} />
      </Panel>
    </>
  );
}

function CatalogTile({
  movie,
  selected,
  busy,
  disabled,
  onToggle,
}: {
  movie: Movie;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || busy}
      aria-pressed={selected}
      aria-label={`${movie.title}${selected ? ', listede. Çıkarmak için seç' : ', listeye ekle'}`}
      className="group block w-full rounded-2xl text-left transition active:scale-[0.97] disabled:cursor-not-allowed [&:disabled:not([aria-pressed=true])]:opacity-35"
    >
      <MovieCard
        movie={movie}
        size="tile"
        className={`aspect-[3/4] transition duration-200 ${
          selected ? 'outline-2 outline-offset-2 outline-amber-300' : 'group-enabled:group-hover:-translate-y-1'
        }`}
      >
        <span
          className={`absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full transition ${
            selected ? 'animate-pop bg-amber-300 text-ink-950' : 'bg-black/40 text-white ring-1 ring-white/25 backdrop-blur'
          }`}
        >
          {busy ? (
            <Spinner className="size-3.5" />
          ) : (
            <Icon name={selected ? 'check' : 'plus'} className="size-4" strokeWidth={selected ? 3 : 2.5} />
          )}
        </span>
      </MovieCard>
    </button>
  );
}

function GenreChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition ${
        active ? 'bg-stone-100 text-ink-950' : 'bg-white/[0.05] text-stone-300 ring-1 ring-white/10 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function CustomTitleForm({ disabled, onAdd }: { disabled: boolean; onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setPending(true);
    const added = await onAdd(clean);
    setPending(false);
    if (added) setTitle('');
  }

  return (
    <form onSubmit={submit} className="mt-6 border-t border-white/[0.07] pt-5">
      <label htmlFor="custom-title" className="block font-semibold text-stone-200">
        Aradığın film katalogda yok mu?
      </label>
      <p className="mt-0.5 text-sm text-stone-500">Adını yaz, listeye özel bir kart olarak eklensin.</p>
      <div className="mt-3 flex gap-2">
        <TextInput
          id="custom-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn. Babamın Ceketi"
          maxLength={LIMITS.customTitleMaxLength}
          enterKeyHint="done"
          disabled={disabled}
        />
        <Button type="submit" size="lg" variant="secondary" icon="plus" loading={pending} disabled={disabled || !title.trim()} className="px-5">
          Ekle
        </Button>
      </div>
    </form>
  );
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
