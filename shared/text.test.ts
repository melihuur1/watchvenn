import { describe, expect, it } from 'vitest';
import { cleanText, foldKey, parseRoomCode } from './text.js';

describe('cleanText', () => {
  it('trims and collapses whitespace, including tabs and newlines', () => {
    expect(cleanText('  Ayşe \t\n  Yılmaz  ')).toBe('Ayşe Yılmaz');
  });

  it('removes control and invisible formatting characters', () => {
    expect(cleanText('Al\u0000i\u0007')).toBe('Ali');
    expect(cleanText('Ve​li')).toBe('Veli'); // zero-width space
    expect(cleanText('‮Ali‬')).toBe('Ali'); // bidi override
    expect(cleanText('﻿Zeynep')).toBe('Zeynep'); // BOM
  });

  it('does not leave double spaces where invisible characters were', () => {
    expect(cleanText('Ali ​ Veli')).toBe('Ali Veli');
  });

  it('normalizes to NFC so visually equal names compare equal', () => {
    const decomposed = 'Şule'; // S + combining cedilla
    expect(cleanText(decomposed)).toBe('Şule');
  });
});

describe('foldKey', () => {
  it('ignores case with Turkish rules', () => {
    expect(foldKey('İSMAİL')).toBe(foldKey('ismail'));
    expect(foldKey('IŞIK')).toBe('ışık');
    expect(foldKey('IŞIK')).not.toBe(foldKey('isik'));
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(foldKey('  Kara   Şövalye ')).toBe(foldKey('kara şövalye'));
  });
});

describe('parseRoomCode', () => {
  it('accepts any casing, spaces and dashes', () => {
    expect(parseRoomCode('K7M2QX')).toBe('K7M2QX');
    expect(parseRoomCode('k7m2qx')).toBe('K7M2QX');
    expect(parseRoomCode(' k7m-2qx ')).toBe('K7M2QX');
  });

  it('rejects ambiguous characters and wrong lengths', () => {
    expect(parseRoomCode('K7M2Q0')).toBeNull(); // zero
    expect(parseRoomCode('K7M2QO')).toBeNull(); // letter O
    expect(parseRoomCode('K7M2Q1')).toBeNull();
    expect(parseRoomCode('K7M2QI')).toBeNull();
    expect(parseRoomCode('K7M2QL')).toBeNull();
    expect(parseRoomCode('K7M2Q')).toBeNull();
    expect(parseRoomCode('K7M2QXA')).toBeNull();
    expect(parseRoomCode('')).toBeNull();
  });
});
