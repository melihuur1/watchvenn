import { LogoMark } from '../components/ui/Logo';

/** Shown while joining: the shape of the room, so nothing jumps when it arrives. */
export function RoomSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6" aria-busy="true">
      <header className="flex h-16 items-center justify-between">
        <LogoMark className="size-8" />
        <span className="skeleton h-9 w-28 rounded-xl" />
      </header>
      <p className="sr-only" role="status">
        Odaya bağlanılıyor…
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <div className="skeleton h-44 rounded-3xl" />
          <div className="skeleton h-56 rounded-3xl" />
        </div>
        <div className="skeleton h-[28rem] rounded-3xl" />
      </div>
    </div>
  );
}
