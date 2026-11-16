import { describe, expect, it } from 'vitest';
import { CATALOG, CUSTOM_PALETTES, GENRE_LABELS, GENRES, customMovie, findCatalogMovie, paletteForTitle } from './catalog.js';
import { foldKey } from './text.js';
import type { Palette } from './types.js';

/** WCAG 2 contrast ratio between white text and a hex color. */
function contrastWithWhite(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return 1.05 / (luminance + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/;
const allPalettes: Palette[] = [...CATALOG.map((m) => m.palette), ...CUSTOM_PALETTES];

describe('catalog', () => {
  it('has about 36 movies with unique ids and titles', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
    expect(CATALOG.length).toBeLessThanOrEqual(40);
    expect(new Set(CATALOG.map((m) => m.id)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((m) => foldKey(m.title))).size).toBe(CATALOG.length);
  });

  it('uses kebab-case ids that cannot collide with custom movie ids', () => {
    for (const movie of CATALOG) {
      expect(movie.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(movie.id.startsWith('custom-')).toBe(false);
    }
  });

  it('has complete, plausible metadata for every movie', () => {
    for (const movie of CATALOG) {
      expect(movie.kind).toBe('catalog');
      expect(movie.title.trim()).not.toBe('');
      expect(movie.originalTitle.trim()).not.toBe('');
      expect(movie.year).toBeGreaterThanOrEqual(1950);
      expect(movie.year).toBeLessThanOrEqual(2026);
      expect(movie.runtime).toBeGreaterThanOrEqual(60);
      expect(movie.runtime).toBeLessThanOrEqual(240);
      expect(movie.description.length).toBeGreaterThan(20);
      expect(movie.description.length).toBeLessThanOrEqual(120);
      expect(movie.genres.length).toBeGreaterThan(0);
      expect(new Set(movie.genres).size).toBe(movie.genres.length);
      for (const genre of movie.genres) expect(GENRES).toContain(genre);
    }
  });

  it('labels every genre and uses every genre at least once', () => {
    expect(new Set(GENRES)).toEqual(new Set(Object.keys(GENRE_LABELS)));
    const used = new Set(CATALOG.flatMap((m) => m.genres));
    for (const genre of GENRES) expect(used).toContain(genre);
  });

  it('keeps white card text readable on every gradient stop (WCAG AA)', () => {
    for (const palette of allPalettes) {
      for (const color of palette) {
        expect(color).toMatch(HEX);
        expect(contrastWithWhite(color), color).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('finds movies by id', () => {
    expect(findCatalogMovie('matrix')?.title).toBe('Matrix');
    expect(findCatalogMovie('nope')).toBeUndefined();
  });
});

describe('custom movies', () => {
  it('get the same gradient for the same title, ignoring case with Turkish rules', () => {
    expect(paletteForTitle('Işıklar Sönmesin')).toBe(paletteForTitle('IŞIKLAR SÖNMESİN'));
    expect(paletteForTitle('  Matrix ')).toBe(paletteForTitle('matrix'));
    expect(CUSTOM_PALETTES).toContain(paletteForTitle('Herhangi bir film'));
  });

  it('spread titles across the palettes', () => {
    const used = new Set(Array.from({ length: 40 }, (_, i) => paletteForTitle(`Film ${i}`)));
    expect(used.size).toBeGreaterThanOrEqual(CUSTOM_PALETTES.length - 2);
  });

  it('are built with kind "custom" and a deterministic palette', () => {
    expect(customMovie('custom-1', 'Babamın Ceketi')).toEqual({
      kind: 'custom',
      id: 'custom-1',
      title: 'Babamın Ceketi',
      palette: paletteForTitle('Babamın Ceketi'),
    });
  });
});
