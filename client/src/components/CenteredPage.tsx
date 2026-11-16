import type { ReactNode } from 'react';
import { followLink } from '../lib/router';
import { Logo } from './ui/Logo';

/** Logo on top, one focused card in the middle: invite, not-found and loading screens. */
export function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center">
        <a href="/" onClick={followLink} className="rounded-xl" aria-label="WatchVenn ana sayfa">
          <Logo />
        </a>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center pt-4 pb-16">{children}</main>
    </div>
  );
}
