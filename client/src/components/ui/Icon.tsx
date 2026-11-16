// A small hand-drawn icon set: 24×24, stroked, currentColor. No icon library needed.
import type { SVGProps } from 'react';

const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  tilde: <path d="M4.5 13.5c2.4-3.2 4.6-3.2 7.5 0s5.1 3.2 7.5 0" />,
  crown: (
    <>
      <path d="M4 17.5L3 8l5 4 4-6.5 4 6.5 5-4-1 9.5z" />
      <path d="M5 20.5h14" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v.5" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V3.5" />
      <path d="M7.5 8L12 3.5 16.5 8" />
      <path d="M5 12.5V19a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-6.5" />
    </>
  ),
  'arrow-left': <path d="M19 12H5.5M11 6l-6 6 6 6" />,
  'arrow-right': <path d="M5 12h13.5M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.4-4.4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3 7h2.5c4.5 0 6.5 10 11 10H21" />
      <path d="M18 14l3 3-3 3" />
      <path d="M3 17h2.5c1.6 0 2.9-1.3 3.9-3" />
      <path d="M14.6 10c1-1.7 2.3-3 3.9-3H21" />
      <path d="M18 4l3 3-3 3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c1.8.7 3 2.4 3.5 5.2" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4h3A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-3" />
      <path d="M9.5 16.5L5 12l4.5-4.5M5 12h10.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 11-2.4-5.7" />
      <path d="M20 4.5v5h-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  sparkle: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />,
  'chevron-down': <path d="M6.5 9.5L12 15l5.5-5.5" />,
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3A4 4 0 0013 5.3l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  film: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.6 16.2a5 5 0 016.8 0M5 12.6a10 10 0 015.2-2.5M13.8 10.2A10 10 0 0119 12.6M2 9a14.5 14.5 0 016.3-3.2M15.7 5.8A14.5 14.5 0 0122 9" />
      <path d="M12 20h.01" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 002 1.8h6a2 2 0 002-1.8L18 7M9 7V4.5h6V7" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
