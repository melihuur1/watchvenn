import { Spinner } from './ui/Spinner';

/** Always mounted, so screen readers announce it when it appears. It fades in after a moment. */
export function ConnectionBanner({ show }: { show: boolean }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3">
      {show && (
        <div className="mt-[calc(env(safe-area-inset-top)+0.6rem)] flex animate-banner items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-ink-950 shadow-[0_10px_30px_-8px_rgb(251_191_36/0.6)]">
          <Spinner className="size-4" />
          Bağlantı yeniden kuruluyor…
        </div>
      )}
    </div>
  );
}
