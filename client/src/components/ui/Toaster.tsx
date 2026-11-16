import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}
type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

const TONES: Record<Tone, { icon: IconName; className: string }> = {
  info: { icon: 'info', className: 'text-amber-200' },
  success: { icon: 'check', className: 'text-emerald-300' },
  error: { icon: 'info', className: 'text-rose-300' },
};

const VISIBLE_MS = 4500;
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ShowToast>((message, tone = 'info') => {
    const id = ++nextId;
    // The same message twice in a row (a double click) shows once.
    setToasts((current) => [...current.filter((t) => t.message !== message).slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), VISIBLE_MS);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 pt-[env(safe-area-inset-top)]"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex max-w-md animate-fade-up items-start gap-2.5 rounded-2xl bg-ink-800/95 px-4 py-3 text-sm text-stone-100 shadow-2xl ring-1 ring-white/10 backdrop-blur"
          >
            <Icon name={TONES[toast.tone].icon} className={`mt-px size-[18px] shrink-0 ${TONES[toast.tone].className}`} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
