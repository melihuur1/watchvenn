import type { Movie } from '@shared/types';

/** 148 → "2 sa 28 dk", 60 → "1 sa", 45 → "45 dk". */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dk`;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

/** "2010 · 2 sa 28 dk" for catalog movies; only the facts we have are shown. */
export function movieMeta(movie: Movie): string {
  if (movie.kind === 'custom') return '';
  return [movie.year, movie.runtime && formatRuntime(movie.runtime)].filter(Boolean).join(' · ');
}

/**
 * Search key: case- and accent-insensitive with Turkish rules, punctuation ignored,
 * so "gora" finds "G.O.R.A.", "baslangic" finds "Başlangıç" and "amelie" finds "Amélie".
 */
export function searchKey(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
