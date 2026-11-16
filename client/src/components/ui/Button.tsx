import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-r from-amber-300 via-orange-400 to-rose-500 text-ink-950 shadow-[0_10px_34px_-10px_rgb(244_63_94/0.65)] hover:brightness-110 disabled:from-ink-700 disabled:via-ink-700 disabled:to-ink-700 disabled:text-stone-500 disabled:shadow-none',
  secondary: 'bg-white/[0.06] text-stone-100 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:opacity-45',
  ghost: 'text-stone-300 hover:bg-white/[0.06] hover:text-stone-50 disabled:opacity-40',
  danger: 'bg-rose-500/10 text-rose-200 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-500/20 disabled:opacity-40',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-sm',
  md: 'h-11 gap-2 rounded-2xl px-4 text-[15px]',
  lg: 'h-14 gap-2.5 rounded-2xl px-6 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  /** Shows a spinner and disables the button while a request is in flight. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 'size-4' : 'size-5';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 select-none items-center justify-center font-semibold transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className={iconSize} /> : icon && <Icon name={icon} className={iconSize} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} className={iconSize} />}
    </button>
  );
}
