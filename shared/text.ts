import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.js';

/**
 * Normalizes user-typed text: NFC, whitespace runs collapsed to one space, control and
 * invisible formatting characters (zero-width, bidi overrides) removed, ends trimmed.
 */
export function cleanText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Comparison key for names and titles (duplicate checks), never for display.
 * Lowercases with Turkish rules so "İSMAİL" matches "ismail", then treats dotless "ı" as "i":
 * caps typed on an English keyboard ("MATRIX", "ISMAIL") must still match "Matrix" and "İsmail".
 */
export function foldKey(text: string): string {
  return cleanText(text).toLocaleLowerCase('tr').replaceAll('ı', 'i');
}

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Accepts any casing and stray spaces or dashes ("k7m-2qx"). Returns null when it can't be a code. */
export function parseRoomCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}
