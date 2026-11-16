import { describe, expect, it } from 'vitest';
import { LIMITS } from '../shared/constants.js';
import {
  parseAddCandidate,
  parseCreateRoom,
  parseCustomTitle,
  parseJoinRoom,
  parseName,
  parsePeekRoom,
  parseRemoveCandidate,
  parseSubmitVote,
} from './validation.js';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const NOT_OBJECTS = [undefined, null, 42, 'text', [], true];

describe('parseName', () => {
  it('cleans the name and keeps it within 1–20 characters', () => {
    expect(parseName('  Ayşe  ')).toBe('Ayşe');
    expect(parseName('Ali​ Veli\u0000')).toBe('Ali Veli');
    expect(parseName('ş'.repeat(LIMITS.nameMaxLength))).toBe('ş'.repeat(LIMITS.nameMaxLength));
  });

  it('counts characters, not UTF-16 units', () => {
    expect(parseName('🍿'.repeat(LIMITS.nameMaxLength))).not.toBeNull(); // 40 UTF-16 units
  });

  it('rejects empty, too long and non-string names', () => {
    expect(parseName('')).toBeNull();
    expect(parseName('   ​ ')).toBeNull();
    expect(parseName('a'.repeat(LIMITS.nameMaxLength + 1))).toBeNull();
    for (const value of [undefined, null, 7, {}, ['Ali']]) expect(parseName(value)).toBeNull();
  });

  it('leaves HTML as plain text for React to escape', () => {
    expect(parseName('<b>Ali</b>')).toBe('<b>Ali</b>');
  });
});

describe('parseCustomTitle', () => {
  it(`allows 1–${LIMITS.customTitleMaxLength} characters`, () => {
    expect(parseCustomTitle(' Babamın   Ceketi ')).toBe('Babamın Ceketi');
    expect(parseCustomTitle('x'.repeat(LIMITS.customTitleMaxLength))).not.toBeNull();
    expect(parseCustomTitle('x'.repeat(LIMITS.customTitleMaxLength + 1))).toBeNull();
    expect(parseCustomTitle('')).toBeNull();
  });
});

describe('room payloads', () => {
  it('parses create and peek', () => {
    expect(parseCreateRoom({ name: ' Ayşe ' })).toEqual({ name: 'Ayşe' });
    expect(parseCreateRoom({ name: '' })).toBeNull();
    expect(parsePeekRoom({ code: 'k7m2qx' })).toEqual({ code: 'K7M2QX' });
    expect(parsePeekRoom({ code: 'NOPE00' })).toBeNull();
    expect(parsePeekRoom({ code: 123456 })).toBeNull();
    for (const value of NOT_OBJECTS) {
      expect(parseCreateRoom(value)).toBeNull();
      expect(parsePeekRoom(value)).toBeNull();
    }
  });

  it('parses a join by token or by name, but not both', () => {
    expect(parseJoinRoom({ code: 'k7m2qx', token: TOKEN })).toEqual({ code: 'K7M2QX', token: TOKEN });
    expect(parseJoinRoom({ code: 'K7M2QX', name: ' Ali ' })).toEqual({ code: 'K7M2QX', name: 'Ali' });

    expect(parseJoinRoom({ code: 'K7M2QX', token: TOKEN, name: 'Ali' })).toBeNull();
    expect(parseJoinRoom({ code: 'K7M2QX' })).toBeNull();
    expect(parseJoinRoom({ code: 'K7M2QX', token: 'short' })).toBeNull();
    expect(parseJoinRoom({ code: 'K7M2QX', token: `${TOKEN}!` })).toBeNull();
    expect(parseJoinRoom({ code: 'K7M2QX', token: 42 })).toBeNull();
    expect(parseJoinRoom({ code: 'K7M2QX', name: '' })).toBeNull();
    expect(parseJoinRoom({ code: 'bad', name: 'Ali' })).toBeNull();
    for (const value of NOT_OBJECTS) expect(parseJoinRoom(value)).toBeNull();
  });
});

describe('candidate payloads', () => {
  it('parses a catalog id or a custom title, but not both', () => {
    expect(parseAddCandidate({ movieId: 'matrix' })).toEqual({ movieId: 'matrix' });
    expect(parseAddCandidate({ customTitle: '  Babamın Ceketi ' })).toEqual({ customTitle: 'Babamın Ceketi' });

    expect(parseAddCandidate({ movieId: 'matrix', customTitle: 'Matrix' })).toBeNull();
    expect(parseAddCandidate({})).toBeNull();
    expect(parseAddCandidate({ customTitle: ' ' })).toBeNull();
    for (const value of NOT_OBJECTS) expect(parseAddCandidate(value)).toBeNull();
  });

  it('accepts only well-formed movie ids', () => {
    expect(parseRemoveCandidate({ movieId: 'custom-0a1b2c3d4e5f' })).toEqual({ movieId: 'custom-0a1b2c3d4e5f' });
    for (const movieId of ['', '__proto__', 'Matrix', 'a b', 'x'.repeat(65), 7, null]) {
      expect(parseRemoveCandidate({ movieId })).toBeNull();
      expect(parseAddCandidate({ movieId })).toBeNull();
    }
  });
});

describe('parseSubmitVote', () => {
  const ballot = { matrix: 'yes', up: 'neutral', alien: 'veto' };

  it('accepts a positive round and a ballot of known votes', () => {
    expect(parseSubmitVote({ round: 2, ballot })).toEqual({ round: 2, ballot });
  });

  it('rejects a bad round', () => {
    for (const round of [0, -1, 1.5, '1', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseSubmitVote({ round, ballot })).toBeNull();
    }
  });

  it('rejects malformed ballots', () => {
    const tooMany = Object.fromEntries(Array.from({ length: LIMITS.maxCandidates + 1 }, (_, i) => [`m-${i}`, 'yes']));
    for (const bad of [
      {},
      tooMany,
      { matrix: 'maybe' },
      { matrix: 2 },
      { matrix: null },
      { __proto__: null, 'not valid': 'yes' },
      JSON.parse('{"__proto__": "yes"}'),
      ['yes', 'no'],
      'yes',
      null,
    ]) {
      expect(parseSubmitVote({ round: 1, ballot: bad })).toBeNull();
    }
    for (const value of NOT_OBJECTS) expect(parseSubmitVote(value)).toBeNull();
  });
});
