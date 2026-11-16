import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

/** A native modal <dialog>: focus trapping, Esc and the backdrop come from the browser. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  tone = 'primary',
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(27rem,calc(100%-2rem))] rounded-3xl bg-ink-850 p-0 text-stone-100 shadow-2xl ring-1 ring-white/10 open:animate-card-in"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-stone-400">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
