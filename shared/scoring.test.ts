import { describe, expect, it } from 'vitest';
import {
  compatibilityLabel,
  computeResults,
  possessive,
  reasonText,
  turnoutText,
} from './scoring.js';
import type { Ballot, Movie, MovieResult, Results, Vote } from './types.js';

const SYMBOLS: Record<string, Vote> = { Y: 'yes', '~': 'neutral', X: 'veto' };

const film = (id: string): Movie => ({ kind: 'custom', id, title: id, palette: ['#000000', '#111111'] });

/**
 * Ballots written as columns, one string per movie and one character per voter:
 * `{ A: 'YY~X' }` means voters 1–2 said Evet to A, voter 3 Fark etmez and voter 4 Veto.
 */
function ballotsFrom(columns: Record<string, string>): { candidates: Movie[]; ballots: Ballot[] } {
  const ids = Object.keys(columns);
  const voters = columns[ids[0]!]!.length;
  const ballots = Array.from({ length: voters }, (_, voter) =>
    Object.fromEntries(ids.map((id) => [id, SYMBOLS[columns[id]![voter]!]!])),
  );
  return { candidates: ids.map(film), ballots };
}

function run(columns: Record<string, string>, voterCount?: number): Results {
  const { candidates, ballots } = ballotsFrom(columns);
  return computeResults(candidates, ballots, voterCount ?? ballots.length);
}

const ids = (list: MovieResult[]) => list.map((r) => r.movie.id);
const byId = (results: Results, id: string) => results.breakdown.find((r) => r.movie.id === id)!;

describe('computeResults', () => {
  it('ranks the worked example from the README', () => {
    const results = run({ A: 'YYY~', B: 'YYYX', C: 'YY~~', D: '~~~~' });

    expect(results.status).toBe('match');
    expect(ids(results.top)).toEqual(['A', 'C', 'D']);
    expect(results.top.map((r) => r.compatibility)).toEqual([88, 75, 50]);
    expect(results.top.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(ids(results.breakdown)).toEqual(['A', 'C', 'D', 'B']);
    expect(byId(results, 'B')).toMatchObject({ yes: 3, neutral: 0, veto: 1, eliminated: true, rank: null });
    expect(byId(results, 'A')).toMatchObject({ yes: 3, neutral: 1, veto: 0, points: 7, tied: false });
  });

  it('lets a single veto beat any number of Evet votes', () => {
    const results = run({ A: 'YYYYYYYYYYYX', B: '~~~~~~~~~~~~' });

    expect(ids(results.top)).toEqual(['B']);
    expect(byId(results, 'A')).toMatchObject({ yes: 11, veto: 1, eliminated: true });
  });

  it('returns a no-match with the full breakdown when every movie is vetoed', () => {
    const results = run({ A: 'XX', B: 'YX', C: '~X' });

    expect(results.status).toBe('no-match');
    expect(results.top).toEqual([]);
    // Eliminated movies are listed fewest vetoes first, then by points.
    expect(ids(results.breakdown)).toEqual(['B', 'C', 'A']);
    expect(results.breakdown.every((r) => r.eliminated && r.rank === null)).toBe(true);
  });

  it('gives tied movies the same rank and keeps candidate-list order', () => {
    const results = run({ A: 'Y~', B: '~Y', C: 'YY', D: '~~' });

    expect(ids(results.top)).toEqual(['C', 'A', 'B']);
    expect(results.top.map((r) => [r.rank, r.tied])).toEqual([
      [1, false],
      [2, true],
      [2, true],
    ]);
    // Competition ranking: after two movies tied for #2 comes #4.
    expect(byId(results, 'D')).toMatchObject({ rank: 4, tied: false });

    const reversed = run({ B: '~Y', A: 'Y~', C: 'YY', D: '~~' });
    expect(ids(reversed.top)).toEqual(['C', 'B', 'A']);
  });

  it('cuts a tie at the podium edge in candidate order', () => {
    const results = run({ A: 'YY', B: 'YY', C: 'YY', D: 'YY' });

    expect(ids(results.top)).toEqual(['A', 'B', 'C']);
    expect(results.top.every((r) => r.rank === 1 && r.tied)).toBe(true);
    expect(byId(results, 'D').rank).toBe(1);
  });

  it('returns fewer than three movies when fewer are eligible', () => {
    const results = run({ A: 'YY', B: 'XY', C: '~Y' });

    expect(results.status).toBe('match');
    expect(ids(results.top)).toEqual(['A', 'C']);
  });

  it('works with a single voter', () => {
    const results = run({ A: 'Y', B: '~', C: 'X' });

    expect(ids(results.top)).toEqual(['A', 'B']);
    expect(results.top.map((r) => r.compatibility)).toEqual([100, 50]);
    expect(results).toMatchObject({ voterCount: 1, ballotCount: 1, excludedCount: 0 });
    expect(compatibilityLabel(results.top[0]!, results)).toBe('Herkes bayıldı');
    expect(reasonText(results.top[0]!, results)).toBe('1 kişi Evet dedi · veto yok');
    expect(reasonText(results.top[1]!, results)).toBe('1 kişi Fark etmez dedi · veto yok');
    expect(turnoutText(results)).toBe('1 kişi oy verdi');
  });

  it('counts only submitted ballots after an early end and words everything for the voters', () => {
    // 5 locked voters, 3 ballots.
    const results = run({ A: 'YY~', B: 'YYY', C: 'X~~', D: '~~~' }, 5);

    expect(results).toMatchObject({ voterCount: 5, ballotCount: 3, excludedCount: 2 });
    // Out of V = 3, not N = 5: 5 points of 6.
    expect(byId(results, 'A').compatibility).toBe(83);
    expect(turnoutText(results)).toBe("5 kişiden 3'ü oy verdi · 2 kişi hesaba katılmadı");

    const [b, a, d] = results.top;
    expect(compatibilityLabel(b!, results)).toBe('Oy verenlerin hepsi bayıldı');
    expect(reasonText(b!, results)).toBe('Oy veren 3 kişinin hepsi Evet dedi · veto yok');
    expect(compatibilityLabel(a!, results)).toBe('Güçlü uyum');
    expect(reasonText(a!, results)).toBe("Oy veren 3 kişiden 2'si Evet, 1'i Fark etmez dedi · veto yok");
    expect(compatibilityLabel(d!, results)).toBe('Oy verenler için uygun');
    expect(reasonText(d!, results)).toBe('Oy veren 3 kişinin hepsi Fark etmez dedi · veto yok');
  });

  it('does not depend on the order ballots were submitted in', () => {
    const { candidates, ballots } = ballotsFrom({ A: 'YY~X~', B: '~Y~YY', C: 'YYY~~', D: 'X~YYY' });
    const expected = computeResults(candidates, ballots, 6);
    const shuffled = [ballots[3]!, ballots[0]!, ballots[4]!, ballots[2]!, ballots[1]!];

    expect(computeResults(candidates, [...ballots].reverse(), 6)).toEqual(expected);
    expect(computeResults(candidates, shuffled, 6)).toEqual(expected);
  });

  it('rounds percentages half up', () => {
    const compat = (column: string) => run({ A: column }).top[0]!.compatibility;

    expect(compat('~')).toBe(50);
    expect(compat('YYY~')).toBe(88); // 87.5
    expect(compat('YYYYYYY~')).toBe(94); // 93.75
    expect(compat('YY~')).toBe(83); // 83.33
    expect(compat('Y~~')).toBe(67); // 66.67
    expect(compat('Y~~~~~')).toBe(58); // 58.33
    expect(compat('YYYYYYYYYYY~')).toBe(96); // 95.83, so 100 % always means all Evet
  });

  it('rejects inputs that break its invariants', () => {
    expect(() => computeResults([film('A')], [], 3)).toThrow(RangeError);
    expect(() => computeResults([film('A')], [{ A: 'yes' }, { A: 'yes' }], 1)).toThrow(RangeError);
    expect(() => computeResults([film('A'), film('B')], [{ A: 'yes' }], 1)).toThrow(/"B"/);
    expect(() => computeResults([film('A')], [{ A: 'maybe' as Vote }], 1)).toThrow(/"A"/);
  });

  it('does not mutate its inputs', () => {
    const { candidates, ballots } = ballotsFrom({ A: 'Y~', B: 'YX' });
    const before = structuredClone({ candidates, ballots });

    computeResults(candidates, ballots, 2);
    expect({ candidates, ballots }).toEqual(before);
  });
});

describe('reason text and labels', () => {
  it('uses the full-group wording when everyone voted', () => {
    const results = run({ A: 'YYYY~', B: 'YYYYY', C: 'YYX~~' });
    const a = byId(results, 'A');

    expect(reasonText(a, results)).toBe("5 kişiden 4'ü Evet, 1'i Fark etmez dedi · veto yok");
    expect(reasonText(byId(results, 'B'), results)).toBe('5 kişinin hepsi Evet dedi · veto yok');
    expect(reasonText(byId(results, 'C'), results)).toBe('1 veto · elendi');
    expect(compatibilityLabel(byId(results, 'C'), results)).toBe('Elendi');
    expect(turnoutText(results)).toBe("5 kişiden 5'i oy verdi");
  });

  it('counts vetoes in the elimination reason', () => {
    const results = run({ A: 'YXX', B: 'YYY' });
    expect(reasonText(byId(results, 'A'), results)).toBe('2 veto · elendi');
  });

  it('switches labels at 100 % and at exactly 75 %', () => {
    const label = (column: string) => {
      const results = run({ A: column });
      return compatibilityLabel(results.top[0]!, results);
    };

    expect(label('YYYY')).toBe('Herkes bayıldı');
    expect(label('YYY~')).toBe('Güçlü uyum'); // 88 %
    expect(label('YY~~')).toBe('Güçlü uyum'); // exactly 75 %
    expect(label('YYYYYY~~~~~~')).toBe('Güçlü uyum'); // 18/24, exactly 75 %
    expect(label('YYYYY~~~~~~~')).toBe('Herkes için uygun'); // 17/24 ≈ 71 %
    expect(label('Y~~~')).toBe('Herkes için uygun'); // 63 %
    expect(label('~~~~')).toBe('Herkes için uygun'); // 50 %
  });
});

describe('possessive', () => {
  it.each([
    [0, "0'ı"],
    [1, "1'i"],
    [2, "2'si"],
    [3, "3'ü"],
    [4, "4'ü"],
    [5, "5'i"],
    [6, "6'sı"],
    [7, "7'si"],
    [8, "8'i"],
    [9, "9'u"],
    [10, "10'u"],
    [11, "11'i"],
    [12, "12'si"],
    [20, "20'si"],
    [30, "30'u"],
    [40, "40'ı"],
    [50, "50'si"],
    [60, "60'ı"],
    [70, "70'i"],
    [80, "80'i"],
    [90, "90'ı"],
    [100, "100'ü"],
    [110, "110'u"],
    [1000, "1000'i"],
  ])('%i → %s', (n, expected) => {
    expect(possessive(n)).toBe(expected);
  });
});
