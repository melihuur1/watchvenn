import type { ReactNode } from 'react';

/** The standard glassy surface. An optional small-caps title and an action on the right. */
export function Panel({
  title,
  action,
  className = '',
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-3xl bg-white/[0.035] p-5 ring-1 ring-white/[0.07] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-bold tracking-wider text-stone-400 uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
