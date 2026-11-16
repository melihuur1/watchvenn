import type { InputHTMLAttributes, Ref } from 'react';

/** 16px text, so iOS doesn't zoom into the field on focus. */
export function TextInput({
  className = '',
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={`h-14 w-full rounded-2xl bg-white/[0.05] px-4 text-base text-stone-50 ring-1 ring-white/10 transition outline-none ring-inset placeholder:text-stone-500 hover:ring-white/20 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-300/70 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
