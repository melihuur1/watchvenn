// How each vote looks everywhere: icon and label, never color alone.
import type { Vote } from '@shared/types';
import { VOTE_LABELS } from '@shared/scoring';
import { Icon, type IconName } from './ui/Icon';

/** Left to right, matching the ← ↓ → keys. */
export const VOTE_ORDER: readonly Vote[] = ['veto', 'neutral', 'yes'];

export const VOTE_STYLES: Record<
  Vote,
  { icon: IconName; keyHint: string; idle: string; active: string; chip: string; stamp: string; exit: string }
> = {
  veto: {
    icon: 'x',
    keyHint: '←',
    idle: 'bg-rose-500/[0.12] text-rose-200 ring-rose-400/30 hover:bg-rose-500/20',
    active: 'bg-rose-500 text-white ring-rose-300',
    chip: 'bg-rose-500/15 text-rose-200',
    stamp: 'border-rose-400 text-rose-300',
    exit: 'animate-exit-left',
  },
  neutral: {
    icon: 'tilde',
    keyHint: '↓',
    idle: 'bg-slate-300/[0.1] text-slate-200 ring-slate-300/25 hover:bg-slate-300/[0.18]',
    active: 'bg-slate-200 text-ink-950 ring-white',
    chip: 'bg-slate-300/15 text-slate-200',
    stamp: 'border-slate-200 text-slate-100',
    exit: 'animate-exit-down',
  },
  yes: {
    icon: 'check',
    keyHint: '→',
    idle: 'bg-emerald-400/[0.12] text-emerald-200 ring-emerald-300/30 hover:bg-emerald-400/20',
    active: 'bg-emerald-400 text-ink-950 ring-emerald-200',
    chip: 'bg-emerald-400/15 text-emerald-200',
    stamp: 'border-emerald-300 text-emerald-300',
    exit: 'animate-exit-right',
  },
};

/** "✓ 3  ~ 1  ✕ 0" with readable labels for screen readers. */
export function VoteCounts({ yes, neutral, veto, className = '' }: { yes: number; neutral: number; veto: number; className?: string }) {
  const counts: Record<Vote, number> = { yes, neutral, veto };
  return (
    <span className={`inline-flex flex-wrap gap-1.5 ${className}`}>
      {(['yes', 'neutral', 'veto'] as const).map((vote) => (
        <span
          key={vote}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${VOTE_STYLES[vote].chip} ${counts[vote] === 0 ? 'opacity-50' : ''}`}
        >
          <Icon name={VOTE_STYLES[vote].icon} className="size-3.5" strokeWidth={3} />
          {counts[vote]}
          <span className="sr-only"> {VOTE_LABELS[vote]}</span>
        </span>
      ))}
    </span>
  );
}
